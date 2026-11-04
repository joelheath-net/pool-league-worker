import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { performTokenRefresh, verifySessionToken } from './token-service.js';
import { clearUserRefreshToken, getUserAccessFlags } from './database.js';

/**
 * Central authentication context middleware.
 * Runs on every request to determine whether the user holds a valid session token.
 * Verifies the token (or attempts server-side refresh if expired) WITHOUT querying the DB
 * for roles or participation status.
 */
export const authContextMiddleware = async (c, next) => {
    c.set('isAuthenticated', false);
    c.set('isParticipating', false);
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
        } else {
            // Token signature is authentic, and its 15-minute access window has expired — attempt server-side refresh
            console.log('[MIDDLEWARE] Token expired, attempting server-side refresh...');
            const userId = payload.sub;
            const { message: refreshStatus, jwt: newToken, payload: newPayload } = await performTokenRefresh(c, userId);

            if (newToken && newPayload) {
                c.set('user', newPayload);
                c.set('isAuthenticated', true);
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

/**
 * Queries the DB for the authenticated user's live `role` and `participating` flags,
 * caching the result on the request context so multiple middlewares/renderers on the
 * same request never execute duplicate DB lookups.
 */
export const resolveUserAccessFlags = async (c) => {
    if (!c.get('isAuthenticated')) {
        return { isAdmin: false, isParticipating: false, exists: false };
    }

    const cached = c.get('accessFlags');
    if (cached) {
        return cached;
    }

    const user = c.get('user');
    const flags = await getUserAccessFlags(c.env.DB, user?.sub);
    c.set('accessFlags', flags);
    c.set('isAdmin', flags.isAdmin);
    c.set('isParticipating', flags.isParticipating);
    return flags;
};

// --- Web (HTML) Route Protection Middleware ---

export const protectWeb = async (c, next) => {
    if (c.get('isAuthenticated')) {
        await next();
    } else {
        return c.redirect('/');
    }
};

export const protectParticipatingWeb = async (c, next) => {
    if (!c.get('isAuthenticated')) {
        return c.redirect('/');
    }
    const { isParticipating } = await resolveUserAccessFlags(c);
    if (!isParticipating) {
        return c.redirect('/');
    }
    await next();
};

export const protectAdminWeb = async (c, next) => {
    if (!c.get('isAuthenticated')) {
        return c.redirect('/');
    }
    const { isAdmin } = await resolveUserAccessFlags(c);
    if (!isAdmin) {
        return c.redirect('/');
    }
    await next();
};

// --- API Route Protection Middleware ---

export const protectAPI = async (c, next) => {
    if (c.get('isAuthenticated')) {
        await next();
    } else {
        return c.json({ message: 'Unauthorized' }, 401);
    }
};

export const protectParticipatingAPI = async (c, next) => {
    if (!c.get('isAuthenticated')) {
        return c.json({ message: 'Unauthorized' }, 401);
    }
    const { isParticipating } = await resolveUserAccessFlags(c);
    if (!isParticipating) {
        return c.json({ message: 'Only participating players can perform this action' }, 403);
    }
    await next();
};

export const protectAdminAPI = async (c, next) => {
    if (!c.get('isAuthenticated')) {
        return c.json({ message: 'Unauthorized' }, 401);
    }
    const { isAdmin } = await resolveUserAccessFlags(c);
    if (!isAdmin) {
        return c.json({ message: 'Access denied' }, 403);
    }
    await next();
};
