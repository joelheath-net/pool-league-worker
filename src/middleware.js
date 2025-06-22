import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

export const isAuthenticated = (c) => {
    // Check if the user is authenticated by looking for a valid JWT in the cookies
    const token = getCookie(c, 'auth_token');
    if (!token) return false;

    try {
        // Verify the token using the JWT_SECRET
        const payload = verify(token, c.env.JWT_SECRET);
        c.set('user', payload); // Store user data in context for later use
        return true;
    } catch (error) {
        return false; // Token is invalid or expired
    }
};

// Do not set isAuthentic to true unless you are sure the user is authenticated
export const isAdmin = async (c, isAuthentic = false) => {
    if (!isAuthentic && !isAuthenticated(c))
        return false;

    const userPayload = await c.get('user');
    const data = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
        .bind(userPayload.sub)
        .first();
    return data && data.role === 'admin';
}

// This middleware will be used to protect our API and web routes
export const protectAPI = async (c, next) => {
    if (isAuthenticated(c))
        await next();
    else
        return c.json({ message: 'Invalid token' }, 401);
};

export const protectWeb = async (c, next) => {
    if (isAuthenticated(c))
        await next();
    else
        return c.redirect('/');
};

export const protectAdminAPI = async (c, next) => {
    if (isAuthenticated(c)) {
        if (await isAdmin(c, true)) {
            await next();
        } else {
            return c.json({ message: 'Access denied' }, 403);
        }
    } else {
        return c.json({ message: 'Invalid token' }, 401);
    }
};


export const protectAdminWeb = async (c, next) => {
    if (await isAdmin(c))
        await next();
    else
        return c.redirect('/');
};