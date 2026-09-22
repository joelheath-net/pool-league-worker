import { Hono } from 'hono';
import { protectWeb, protectAdminWeb } from './middleware';

import { Layout } from '../views/layout';
import { LeaderboardPage } from '../views/leaderboard';
import { LogGamePage } from '../views/log-game';
import { GamesPage } from '../views/game-list';
import { OutstandingGamesPage } from '../views/outstanding-games';
import { AuditPage } from '../views/audit-log';
import { CustomizePage } from '../views/customize';
import { EditGamePage } from '../views/edit-game';
import { AdminPage } from '../views/admin-panel';
import { ArchivedLeaderboardPage } from '../views/archived-leaderboard';
import { SeasonsPage } from '../views/seasons';
import { PrivacyPolicyPage } from '../views/privacy-policy';
import { TermsOfServicePage } from '../views/terms-of-service';
import { AboutPage } from '../views/about';


const web = new Hono();

web.use('*', async (c, next) => {
    c.setRenderer(async (content, props) => {
        const title = props.title || "St Paul's League";
        const style = props.style;
        const script = props.script;
        const isAuthenticated = c.get('isAuthenticated');
        const isAdmin = c.get('isAdmin');

        return c.html(
            <Layout {...{ title, style, script, isAuthenticated, isAdmin }}>
                {content}
            </Layout>
        );
    });
    await next();
});

// --- Public Routes ---
web.get('/', (c) => {
    return c.render(<LeaderboardPage />, { title: `St Paul's League`, script: '/js/leaderboard.js' });
});

web.get('/about', (c) => {
    return c.render(<AboutPage />, { title: "About - St Paul's League" });
});

web.get('/game-list', (c) => {
    return c.render(<GamesPage isAuthenticated={c.get('isAuthenticated')} />, { title: 'Game History', script: '/js/game-list.js' });
});

web.get('/outstanding-games', (c) => {
    const roundsParam = c.req.query('rounds');
    const rounds = roundsParam ? parseInt(roundsParam, 10) : 2;
    return c.render(
        <OutstandingGamesPage rounds={isNaN(rounds) || rounds < 1 ? 2 : rounds} isAuthenticated={c.get('isAuthenticated')} />,
        { title: 'Outstanding Games', script: '/js/outstanding-games.js' }
    );
});

web.get('/seasons', (c) => {
    return c.render(<SeasonsPage />, { title: 'Season Archive', script: '/js/seasons.js' });
});

web.get('/archive', (c) => {
    return c.redirect('/seasons');
});

web.get('/archive/:seasonId', (c) => {
    const { seasonId } = c.req.param();
    return c.render(<ArchivedLeaderboardPage seasonId={seasonId} />, { title: `Archived Season ${seasonId}`, script: '/js/archived-leaderboard.js' });
});

web.get('/privacy-policy', (c) => {
    return c.render(<PrivacyPolicyPage />, { title: "Privacy Policy - St Paul's League" });
});

web.get('/privacy', (c) => {
    return c.redirect('/privacy-policy');
});

web.get('/terms-of-service', (c) => {
    return c.render(<TermsOfServicePage />, { title: "Terms of Service - St Paul's League" });
});

web.get('/terms', (c) => {
    return c.redirect('/terms-of-service');
});

// --- Protected Routes ---
web.get('/log-game', protectWeb, (c) => {
    return c.render(<LogGamePage />, { title: 'Log a Game', script: '/js/log-game.js' });
});



web.get('/audit-log', protectWeb, (c) => {
    return c.render(<AuditPage />, { title: 'Audit Log', script: '/js/audit-log.js', style: '/css/audit-log.css' });
});

web.get('/profile', protectWeb, (c) => {
    return c.render(<CustomizePage />, { title: 'Customise Profile', script: '/js/customize.js', });
});

web.get('/edit-game', protectWeb, (c) => {
    return c.render(<EditGamePage />, { title: 'Edit Game', script: '/js/edit-game.js', style: '/css/edit-game.css' });
});

// Admin-only route
web.get('/admin-panel', protectAdminWeb, (c) => {
    return c.render(<AdminPage />, { title: 'Admin Panel', script: '/js/admin-panel.js' });
});

export default web;