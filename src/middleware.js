import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { performTokenRefresh, verifySessionToken } from './token-service.js';
import { clearUserRefreshToken } from './database.js';

/**
 * THIS IS THE NEW CENTRAL MIDDLEWARE.
 * It runs on every request to determine the user's auth status.
 * It will verify a token, and if it's expired, it will attempt a refresh.
 * It populates c.get('isAuthenticated') and c.get('isAdmin') for all downstream middleware and renderers.
 */
export const authContextMiddleware = async (c, next) => {
    // Set defaults
    c.set('isAuthenticated', false);
    c.set('isAdmin', false);

    const token = getCookie(c, 'auth_token');
    if (!token) {
        return await next();
    }

    try {
        // Always cryptographically verify the HMAC signature BEFORE trusting claims or attempting refresh
        const { payload, isExpired } = await verifySessionToken(token, c.env);

        if (!isExpired) {
            c.set('user', payload);
            c.set('isAuthenticated', true);
            c.set('isAdmin', payload.role === 'admin');
        } else {
            // Token signature is authentic, and its 15-minute access window has expired — attempt server-side refresh
            console.log('[MIDDLEWARE] Token expired, attempting server-side refresh...');
            const userId = payload.sub;
            const { message: refreshStatus, jwt: newToken, payload: newPayload } = await performTokenRefresh(c, userId);

            if (newToken && newPayload) {
                c.set('user', newPayload);
                c.set('isAuthenticated', true);
                c.set('isAdmin', newPayload.role === 'admin');
                console.log('[MIDDLEWARE] Token refreshed successfully.');
            } else {
                deleteCookie(c, 'auth_token', { path: '/' });

                if (refreshStatus === 'INVALID_GRANT') {
                    console.warn(`[MIDDLEWARE] Google refresh token invalid for user ${userId}. Clearing from DB.`);
                    await clearUserRefreshToken(c.env.DB, userId);
                    setCookie(c, 'reconsent_needed', 'true', { path: '/', maxAge: 60 * 60 * 24 * 7 }); // 7 days
                } else if (refreshStatus === 'NO_REFRESH_TOKEN') {
                    setCookie(c, 'reconsent_needed', 'true', { path: '/', maxAge: 60 * 60 * 24 * 7 }); // 7 days
                }
            }
        }
    } catch (error) {
        deleteCookie(c, 'auth_token', { path: '/' });
    }

    await next();
};


// --- The protection middleware are now very simple ---

export const protectWeb = async (c, next) => {
    if (await c.get('isAuthenticated')) {
        await next();
    } else {
        return c.redirect('/');
    }
};

export const protectAdminWeb = async (c, next) => {
    if (await c.get('isAuthenticated') && await c.get('isAdmin')) {
        await next();
    } else {
        return c.redirect('/');
    }
};

export const protectAPI = async (c, next) => {
    if (await c.get('isAuthenticated')) {
        await next();
    } else {
        return c.json({ message: 'Unauthorized' }, 401);
    }
};

export const protectAdminAPI = async (c, next) => {
    if (!await c.get('isAuthenticated'))
        return c.json({ message: 'Unauthorized' }, 401);
    if (!await c.get('isAdmin'))
        return c.json({ message: 'Access denied' }, 403);

    await next();
};
