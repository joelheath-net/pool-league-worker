import { Hono } from 'hono';
import { protectWeb, protectAdminWeb, isAuthenticated as isAuthentic, isAdmin as checkAdmin } from './middleware';

import { Layout } from '../views/layout';
import { LeaderboardPage } from '../views/leaderboard';
import { LogGamePage } from '../views/log-game';
import { GamesPage } from '../views/game-list';
import { AuditPage } from '../views/audit-log';
import { CustomizePage } from '../views/customize';
import { EditGamePage } from '../views/edit-game';
import { AdminPage } from '../views/admin-panel';

const web = new Hono();

// Use Hono's renderer middleware
web.use('*', async (c, next) => {
    c.setRenderer(async (content, props) => {
        const title = props.title || 'St Paul\'s League';
        const style = props.style;
        const script = props.script;
        const isAuthenticated = isAuthentic(c);
        const isAdmin = isAuthenticated && (await checkAdmin(c, true));

        return c.html(
            <Layout {...{ title, style, script, isAuthenticated, isAdmin }}>
                {content}
            </Layout>
        );
    });
    await next();
});

web.get('/', (c) => {
    return c.render(<LeaderboardPage />, { title: `St Paul's League`, script: '/js/leaderboard.js' });
});

web.get('/log-game', protectWeb, (c) => {
    return c.render(<LogGamePage />, { title: 'Log a Game', script: '/js/log-game.js' });
});

web.get('/game-list', protectWeb, (c) => {
    return c.render(<GamesPage />, { title: 'Game History', script: '/js/game-list.js' });
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

web.get('/admin-panel', protectAdminWeb, (c) => {
    return c.render(<AdminPage />, { title: 'Admin Panel', script: '/js/admin-panel.js' });
});

export default web;