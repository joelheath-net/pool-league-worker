import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { sign, decode } from 'hono/jwt';
import { findOrCreateUser } from './database.js';
import { performTokenRefresh } from './token-service.js';
import {accessTokenExpiresIn, refreshTokenExpiresIn} from './token-service.js';

const auth = new Hono();

// Route to start the OAuth flow
auth.get('/google/login', (c) => {
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    const currentUrl = new URL(c.req.url);
    const redirect_uri = `${currentUrl.origin}/auth/google/callback`;

    googleAuthUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', redirect_uri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid profile email');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    // googleAuthUrl.searchParams.set('prompt', 'consent');

    return c.redirect(googleAuthUrl.toString());
});

// Callback route that Google redirects to
auth.get('/google/callback', async (c) => {
    const code = c.req.query('code');
    if (!code) {
        return c.text('Authorization code is missing.', 400);
    }

    const currentUrl = new URL(c.req.url);
    const redirect_uri = `${currentUrl.origin}/auth/google/callback`;

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                client_id: c.env.GOOGLE_CLIENT_ID,
                client_secret: c.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();
        if (!tokens.access_token) {
            console.error('Failed to fetch access token:', tokens);
            return c.text('Failed to obtain access token.', 500);
        }
        
        const idTokenPayload = decode(tokens.id_token).payload;

        const whitelist = (c.env.EMAIL_WHITELIST || '');
        if (whitelist && !whitelist.split(',').includes(idTokenPayload.email)) {
            return c.redirect('/');
        }

        const user = await findOrCreateUser(c.env.DB, idTokenPayload, tokens);

        const payload = {
            sub: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + accessTokenExpiresIn,
        };
        const jwt = await sign(payload, c.env.JWT_SECRET);
        
        setCookie(c, 'auth_token', jwt, {
            path: '/',
            secure: true,
            httpOnly: true,
            maxAge: refreshTokenExpiresIn,
            sameSite: 'Lax',
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
        payload = decode(authToken).payload;
    } catch (e) {
        return c.json({ message: 'Invalid token' }, 401);
    }
    
    const userId = payload?.sub;
    const refreshed = await performTokenRefresh(c, userId);
    
    if (refreshed) {
        return c.json({ message: 'Token refreshed' });
    } else {
        deleteCookie(c, 'auth_token', { path: '/' });
        return c.json({ message: 'Failed to refresh token' }, 401);
    }
});

auth.get('/logout', (c) => {
    deleteCookie(c, 'auth_token', {
        path: '/',
    });
    return c.redirect('/');
});

export default auth;