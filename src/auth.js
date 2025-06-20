import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { googleAuth } from '@hono/oauth-providers/google';

const auth = new Hono();

auth.use('/google', async (c, next) => {
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

        // Find or create the user in our D1 database
        let user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
            .bind(googleUser.id)
            .first();

        if (!user) {
            // User doesn't exist, create them
            const newUser = {
                id: googleUser.id,
                name: googleUser.name,
                email: googleUser.email,
            };
            await c.env.DB.prepare(
                'INSERT INTO users (id, name, email) VALUES (?, ?, ?)'
            )
            .bind(newUser.id, newUser.name, newUser.email)
            .run();
            user = newUser;
        }

        // Create a JWT payload
        const payload = {
            sub: user.id, // Subject (the user's ID)
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // Expires in 7 days
        };

        // Sign the JWT with our secret
        const jwt = await sign(payload, c.env.JWT_SECRET);

        // Store the JWT in a secure, HttpOnly cookie
        setCookie(c, 'auth_token', jwt, {
            path: '/',
            secure: true,
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7, // 7 days
            sameSite: 'Lax',
        });

        // Redirect to the home page
        return c.redirect('/');
    }
);

/**
 * The /auth/logout route.
 * Deletes the session cookie and redirects the user to the homepage.
 */
auth.get('/logout', (c) => {
    deleteCookie(c, 'auth_token', {
        path: '/',
    });
    // Redirect to the home page after logging out.
    return c.redirect('/');
});

export default auth;