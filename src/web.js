import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

// Import all of your HTML and CSS files as raw text
import leaderboardAuth from '../views/leaderboard-auth.html';
import leaderboardUnauth from '../views/leaderboard-unauth.html';
import signinPage from '../views/signin.html';
import logGamePage from '../views/log-game.html';
import gameListPage from '../views/game-list.html';
import customizePage from '../views/customize.html'; // Renamed from customize.html for clarity
import editGamePage from '../views/edit-game.html';
import auditLogPage from '../views/audit-log.html';

import styleCss from '../public/css/style.css';
import logGameCss from '../public/css/log-game.css';
import customizeCss from '../public/css/customize.css';

const web = new Hono();

// --- Middleware to check authentication status for pages ---
// This is slightly different from the API middleware; it doesn't block,
// it just checks for a user and attaches it to the context.
const pageAuthMiddleware = async (c, next) => {
    const token = getCookie(c, 'auth_token');
    if (token) {
        try {
            const payload = await verify(token, c.env.JWT_SECRET);
            c.set('user', payload);
        } catch (e) {
            // Invalid token, treat as logged out
            c.set('user', null);
        }
    }
    await next();
};

// Helper to return a response with the correct Content-Type
const html = (content) => new Response(content, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const css = (content) => new Response(content, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });

// --- CSS Routes ---
web.get('/css/leaderboard.css', (c) => css(leaderboardCss));
web.get('/css/style.css', (c) => css(styleCss));
web.get('/css/log-game.css', (c) => css(logGameCss));
web.get('/css/customize.css', (c) => css(customizeCss));

// --- Page Routes ---

// The root route decides which leaderboard to show
web.get('/', pageAuthMiddleware, (c) => {
    const user = c.get('user');
    return user ? html(leaderboardAuth) : html(leaderboardUnauth);
});

web.get('/signin', (c) => html(signinPage));

// For all subsequent pages, we require the user to be logged in.
// If they aren't, we redirect them to the sign-in page.
web.use('/log-game', pageAuthMiddleware);
web.use('/game-list', pageAuthMiddleware);
web.use('/profile', pageAuthMiddleware);
web.use('/edit-game', pageAuthMiddleware);
web.use('/audit-log', pageAuthMiddleware);

const requireAuth = async (c, next) => {
    if (!c.get('user')) {
        return c.redirect('/signin');
    }
    await next();
};

web.get('/log-game', requireAuth, (c) => html(logGamePage));
web.get('/game-list', requireAuth, (c) => html(gameListPage));
web.get('/profile', requireAuth, (c) => html(customizePage));
web.get('/edit-game', requireAuth, (c) => html(editGamePage));
web.get('/audit-log', requireAuth, (c) => html(auditLogPage));

export default web;