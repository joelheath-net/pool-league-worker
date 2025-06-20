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

// This middleware will be used to protect our API and web routes
export const authMiddleware = async (c, next) => {
    if (isAuthenticated(c)) {
        await next();
    } else {
        return c.json({ message: 'Invalid token' }, 401);
    }
};