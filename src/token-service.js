import { setCookie } from 'hono/cookie';
import { sign, verify, decode } from 'hono/jwt';
import { getUserForRefresh, updateUserTokens, isEmailWhitelisted } from './database.js';

export const JWT_ALGORITHM = 'HS256';
export const accessTokenExpiresIn = 60 * 15; // 15 minutes
export const refreshTokenExpiresIn = 60 * 60 * 24 * 90; // 90 days

const importHmacKey = async (env, usage) => {
    const rawSecret = env?.JWT_SECRET;
    if (!rawSecret || typeof rawSecret !== 'string' || !rawSecret.trim()) {
        throw new Error('JWT_SECRET environment secret is missing or invalid.');
    }
    return await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(rawSecret.trim()),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [usage]
    );
};

export const signAuthToken = async (user, env) => {
    const signingKey = await importHmacKey(env, 'sign');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: user.id,
        email: user.email,
        iat: now,
        exp: now + accessTokenExpiresIn,
    };
    const jwt = await sign(payload, signingKey, JWT_ALGORITHM);
    return { jwt, payload };
};

/**
 * Cryptographically verifies a session JWT against `env.JWT_SECRET` BEFORE checking expiry.
 * Note: Hono's `verify()` checks `exp` before checking the cryptographic signature, so calling
 * `verify()` with `exp: true` throws `JwtTokenExpired` even on forged unsigned/fake-signed tokens.
 * Passing `exp: false` forces signature verification first; we then evaluate expiration ourselves.
 */
export const verifySessionToken = async (token, env) => {
    const verifyKey = await importHmacKey(env, 'verify');
    if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
    }

    const { header } = decode(token);
    if (!header || header.alg !== JWT_ALGORITHM) {
        throw new Error('Invalid JWT algorithm');
    }

    const payload = await verify(token, verifyKey, {
        alg: JWT_ALGORITHM,
        exp: false,
        iat: false,
        nbf: false,
    });

    if (!payload || typeof payload.sub !== 'string' || !payload.sub || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        throw new Error('Invalid JWT payload claims');
    }

    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp <= now;

    if (isExpired) {
        const issuedAt = typeof payload.iat === 'number' && Number.isFinite(payload.iat)
            ? payload.iat
            : payload.exp - accessTokenExpiresIn;
        if (now - issuedAt > refreshTokenExpiresIn) {
            throw new Error('Token refresh window expired');
        }
    }

    return { payload, isExpired };
};

export const performTokenRefresh = async (c, userId) => {
    if (!userId) {
        console.error('[TOKEN-SERVICE] Refresh failed: No userId provided.');
        return { message: 'INVALID_USER', jwt: null, payload: null };
    }

    const user = await getUserForRefresh(c.env.DB, userId);

    if (!user) {
        console.error(`[TOKEN-SERVICE] Refresh failed: User ${userId} not found in DB.`);
        return { message: 'USER_NOT_FOUND', jwt: null, payload: null };
    }

    const whitelisted = await isEmailWhitelisted(c.env.DB, user.email);
    if (!whitelisted) {
        console.warn(`[TOKEN-SERVICE] Refresh rejected: ${user.email} is no longer whitelisted.`);
        return { message: 'NOT_WHITELISTED', jwt: null, payload: null };
    }

    if (!user.googleRefreshToken) {
        console.error(`[TOKEN-SERVICE] Refresh failed: No refresh token found in DB for user ${userId}.`);
        return { message: 'NO_REFRESH_TOKEN', jwt: null, payload: null };
    }

    try {
        const bodyParams = new URLSearchParams({
            client_id: c.env.GOOGLE_CLIENT_ID,
            client_secret: c.env.GOOGLE_CLIENT_SECRET,
            refresh_token: user.googleRefreshToken,
            grant_type: 'refresh_token',
        });

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString(),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error(`[TOKEN-SERVICE] Refresh failed: Google API returned an error for user ${userId}.`, tokenData);
            if (tokenData?.error === 'invalid_grant') {
                return { message: 'INVALID_GRANT', jwt: null, payload: null };
            }
            return { message: 'GOOGLE_API_ERROR', jwt: null, payload: null };
        }

        await updateUserTokens(c.env.DB, userId, tokenData.access_token, tokenData.expires_in);

        const { jwt: newJwt, payload: newPayload } = await signAuthToken(user, c.env);

        setCookie(c, 'auth_token', newJwt, {
            path: '/',
            secure: true,
            httpOnly: true,
            maxAge: refreshTokenExpiresIn,
            sameSite: 'Lax',
        });

        console.log(`[TOKEN-SERVICE] Refresh successful for user ${userId}. New JWT issued.`);

        return { message: 'REFRESH_SUCCESS', jwt: newJwt, payload: newPayload };

    } catch (error) {
        console.error(`[TOKEN-SERVICE] Refresh failed: An unexpected error occurred for user ${userId}.`, error);
        return { message: 'UNEXPECTED_ERROR', jwt: null, payload: null };
    }
};
