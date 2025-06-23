import { setCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { getUserForRefresh, updateUserTokens } from './database.js';

export const accessTokenExpiresIn = 10; //60 * 15; // 15 minutes
export const refreshTokenExpiresIn = 60 * 60 * 24 * 30; // 30 days

/**
 * Performs a token refresh using a user's Google refresh token.
 * @param {import('hono').Context} c - The Hono context.
 * @param {string} userId - The ID of the user whose token needs refreshing.
 * @returns {Promise<boolean>} - True if refresh was successful, false otherwise.
 */
export const performTokenRefresh = async (c, userId) => {
    if (!userId) {
        console.error('[TOKEN-SERVICE] Refresh failed: No userId provided.');
        return false;
    }

    const user = await getUserForRefresh(c.env.DB, userId);

    if (!user || !user.google_refresh_token) {
        console.error(`[TOKEN-SERVICE] Refresh failed: No refresh token found in DB for user ${userId}.`);
        return false;
    }

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: c.env.GOOGLE_CLIENT_ID,
                client_secret: c.env.GOOGLE_CLIENT_SECRET,
                refresh_token: user.google_refresh_token,
                grant_type: 'refresh_token',
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error(`[TOKEN-SERVICE] Refresh failed: Google API returned an error for user ${userId}.`, tokenData);
            return false;
        }

        await updateUserTokens(c.env.DB, userId, {
            access_token: tokenData.access_token,
            expires_in: tokenData.expires_in,
        });

        const newPayload = {
            sub: userId,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + accessTokenExpiresIn,
        };
        const newJwt = await sign(newPayload, c.env.JWT_SECRET);

        setCookie(c, 'auth_token', newJwt, {
            path: '/',
            secure: true,
            httpOnly: true,
            maxAge: refreshTokenExpiresIn,
            sameSite: 'Lax',
        });
        
        console.log(`[TOKEN-SERVICE] Refresh successful for user ${userId}. New JWT issued.`);

        return newJwt; // Success!

    } catch (error) {
        console.error(`[TOKEN-SERVICE] Refresh failed: An unexpected error occurred for user ${userId}.`, error);
        return null;
    }
};