import { getCookie, setCookie } from 'hono/cookie';
import { verify, decode } from 'hono/jwt';
import { performTokenRefresh } from './token-service.js';
import * as db from './database.js';

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
        const payload = await verify(token, c.env.JWT_SECRET);
        c.set('user', payload);
        c.set('isAuthenticated', true);
        c.set('isAdmin', payload.role === 'admin');
    } catch (error) {
        // If token is expired, try to refresh it
        if (error.name === 'JwtTokenExpired') {
            console.log('[MIDDLEWARE] Token expired, attempting server-side refresh...');
            const { payload } = decode(token);
            const userId = payload?.sub;
            if (userId) {
                const { message: refreshStatus, jwt: newToken } = await performTokenRefresh(c, userId);
                
                if (newToken) {
                    // If refresh worked, the new token is in the cookie. We need to verify it to set the context for the current request.
                    const newPayload = await verify(newToken, c.env.JWT_SECRET);
                    c.set('user', newPayload);
                    c.set('isAuthenticated', true);
                    c.set('isAdmin', newPayload.role === 'admin');
                    console.log('[MIDDLEWARE] Token refreshed successfully.');
                } else if (refreshStatus === 'NO_REFRESH_TOKEN') {
                    setCookie(c, 'reconsent_needed', 'true', { path: '/', maxAge: 60 * 5 }); // Expires in 5 minutes
                }
            }
        }
        // For any other error, we just leave the user as unauthenticated.
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