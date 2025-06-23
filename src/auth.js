import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { googleAuth } from '@hono/oauth-providers/google';
import { isAuthenticated } from './middleware';
import { findOrCreateUser } from './database.js';

const auth = new Hono();

auth.use('/google', async (c, next) => {
    if (isAuthenticated(c))
        return c.redirect('/');

    const googleAuthMiddleware = googleAuth({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        scope: ['profile', 'email'],
    });
    
    return await googleAuthMiddleware(c, next);
});

auth.get(
    '/google',
    async (c) => {
        const token = c.get('token');
        const grantedScopes = c.get('granted-scopes');
        const googleUser = c.get('user-google');    

        const whitelist = (c.env.EMAIL_WHITELIST || '');
        if (whitelist && !whitelist.split(',').includes(googleUser.email)) {
            return c.redirect('/');
        }

        const user = await findOrCreateUser(c.env.DB, googleUser);

        const expires = 60 * 60 * 24 * 7; // 7 days

        const payload = {
            sub: user.id, // Subject (the user's ID)
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (expires),
        };

        const jwt = await sign(payload, c.env.JWT_SECRET);
        
        setCookie(c, 'auth_token', jwt, {
            path: '/',
            secure: true,
            httpOnly: true,
            maxAge: expires,
            sameSite: 'Lax',
        });

        return c.redirect('/');
    }
);

auth.get('/logout', (c) => {
    deleteCookie(c, 'auth_token', {
        path: '/',
    });
    return c.redirect('/');
});

export default auth;