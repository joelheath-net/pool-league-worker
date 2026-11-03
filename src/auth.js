import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { verifyWithJwks } from 'hono/jwt';
import { findOrCreateUser, isEmailWhitelisted, deletePushSubscriptionsForUser } from './database.js';
import {
    performTokenRefresh,
    refreshTokenExpiresIn,
    signAuthToken,
    verifySessionToken
} from './token-service.js';

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUER_PATTERN = /^https:\/\/accounts\.google\.com$|^accounts\.google\.com$/;

const auth = new Hono();

// Route to start the OAuth flow
auth.get('/google/login', (c) => {
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    const currentUrl = new URL(c.req.url);
    const redirectUri = `${currentUrl.origin}/auth/google/callback`;

    const state = crypto.randomUUID();
    setCookie(c, 'oauth_state', state, {
        path: '/',
        secure: currentUrl.protocol === 'https:',
        httpOnly: true,
        maxAge: 60 * 10, // 10 minutes
        sameSite: 'Lax'
    });

    googleAuthUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid profile email');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('state', state);

    const reconsentNeeded = getCookie(c, 'reconsent_needed') || c.req.query('prompt') === 'consent';
    if (reconsentNeeded) {
        googleAuthUrl.searchParams.set('prompt', 'consent');
        deleteCookie(c, 'reconsent_needed', { path: '/' });
    }

    return c.redirect(googleAuthUrl.toString());
});

// Callback route that Google redirects to
auth.get('/google/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const savedState = getCookie(c, 'oauth_state');
    deleteCookie(c, 'oauth_state', { path: '/' });

    if (!code) {
        return c.text('Authorization code is missing.', 400);
    }

    if (!state || !savedState || state !== savedState) {
        console.warn('[AUTH] OAuth callback rejected due to missing or mismatched state.');
        return c.text('Invalid OAuth state.', 400);
    }

    const currentUrl = new URL(c.req.url);
    const redirectUri = `${currentUrl.origin}/auth/google/callback`;

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                client_id: c.env.GOOGLE_CLIENT_ID,
                client_secret: c.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();
        if (!tokenResponse.ok || !tokens.access_token || !tokens.id_token) {
            console.error('Failed to fetch access/ID token:', tokens);
            return c.text('Failed to obtain access token.', 500);
        }

        const idTokenPayload = await verifyWithJwks(tokens.id_token, {
            jwks_uri: GOOGLE_JWKS_URI,
            verification: {
                iss: GOOGLE_ISSUER_PATTERN,
                iat: false
            }
        });

        if (idTokenPayload.aud !== c.env.GOOGLE_CLIENT_ID || !idTokenPayload.email_verified) {
            console.error('[AUTH] Google ID token audience or email verification check failed.');
            return c.text('Invalid ID token.', 401);
        }

        const isWhitelisted = idTokenPayload.email && await isEmailWhitelisted(c.env.DB, idTokenPayload.email);
        if (!isWhitelisted) {
            console.warn(`[AUTH] Login rejected: ${idTokenPayload.email} is not whitelisted`);
            return c.redirect('/');
        }

        const user = await findOrCreateUser(c.env.DB, idTokenPayload, tokens);

        // Self-healing check: if Google did not issue a refresh token and user does not have one in DB,
        // re-route through consent prompt to obtain and store a healthy refresh token.
        if (!user.hasRefreshToken) {
            console.warn(`[AUTH] User ${user.id} has no refresh token. Prompting for consent.`);
            return c.redirect('/auth/google/login?prompt=consent');
        }

        const { jwt } = await signAuthToken(user, c.env);

        setCookie(c, 'auth_token', jwt, {
            path: '/',
            secure: true,
            httpOnly: true,
            maxAge: refreshTokenExpiresIn,
            sameSite: 'Lax'
        });

        return c.redirect('/');
    } catch (error) {
        console.error('OAuth callback error:', error);
        return c.text('An error occurred during authentication.', 500);
    }
});

auth.post('/refresh', async (c) => {
    const authToken = getCookie(c, 'auth_token');
    if (!authToken) {
        return c.json({ message: 'No auth token' }, 401);
    }

    let payload;
    try {
        ({ payload } = await verifySessionToken(authToken, c.env));
    } catch (e) {
        deleteCookie(c, 'auth_token', { path: '/' });
        return c.json({ message: 'Invalid token' }, 401);
    }

    const refreshed = await performTokenRefresh(c, payload.sub);

    if (refreshed?.jwt) {
        return c.json({ message: 'Token refreshed' });
    } else {
        deleteCookie(c, 'auth_token', { path: '/' });
        return c.json({ message: 'Failed to refresh token' }, 401);
    }
});

auth.get('/logout', async (c) => {
    const authToken = getCookie(c, 'auth_token');
    if (authToken) {
        try {
            const { payload } = await verifySessionToken(authToken, c.env);
            if (payload?.sub) {
                await deletePushSubscriptionsForUser(c.env.DB, payload.sub);
            }
        } catch (e) {
            console.warn('[AUTH] Ignoring invalid token during push cleanup on logout.');
        }
    }
    deleteCookie(c, 'auth_token', { path: '/' });
    return c.redirect('/');
});


export default auth;
