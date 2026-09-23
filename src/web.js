import { Hono } from 'hono';
import { protectWeb, protectAdminWeb } from './middleware';
import * as db from './database';

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
import { AllTimeLeaderboardPage } from '../views/all-time-leaderboard';
import { SeasonsPage } from '../views/seasons';
import { PrivacyPolicyPage } from '../views/privacy-policy';
import { TermsOfServicePage } from '../views/terms-of-service';
import { AboutPage } from '../views/about';
import { NotFoundPage } from '../views/not-found';


const web = new Hono();

// --- Crawler and Discovery Endpoints ---
web.get('/robots.txt', (c) => {
    const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /admin/
Disallow: /admin-panel
Disallow: /log-game
Disallow: /edit-game
Disallow: /profile
Disallow: /audit-log

Sitemap: https://stpaulsleague.joelheath.net/sitemap.xml
`;
    return c.text(robots, 200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400'
    });
});

web.get('/sitemap.xml', async (c) => {
    let seasons = [];
    try {
        if (c.env?.DB) {
            seasons = await db.getArchivedSeasons(c.env.DB);
        }
    } catch (error) {
        console.error('Error fetching seasons for sitemap:', error);
    }

    const staticRoutes = [
        '/',
        '/about',
        '/game-list',
        '/outstanding-games',
        '/seasons',
        '/archive/all-time',
        '/privacy-policy',
        '/terms-of-service'
    ];

    const seasonRoutes = Array.isArray(seasons) ? seasons.map((s) => `/archive/${s.id}`) : [];
    const allRoutes = [...staticRoutes, ...seasonRoutes];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map((path) => `  <url>
    <loc>https://stpaulsleague.joelheath.net${path}</loc>
    <changefreq>weekly</changefreq>
  </url>`).join('\n')}
</urlset>`;

    return c.text(xml, 200, {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600'
    });
});

web.use('*', async (c, next) => {
    c.setRenderer(async (content, props) => {
        const title = props.title || "St Paul's League";
        const description = props.description;
        const robots = props.robots;
        const style = props.style;
        const script = props.script;
        const canonicalUrl = props.canonicalUrl || `https://stpaulsleague.joelheath.net${c.req.path}`;
        const isAuthenticated = c.get('isAuthenticated');
        const isAdmin = c.get('isAdmin');

        return c.html(
            <Layout {...{ title, description, robots, style, script, canonicalUrl, isAuthenticated, isAdmin }}>
                {content}
            </Layout>
        );
    });
    await next();
});

// --- Public Routes ---
web.get('/', (c) => {
    return c.render(<LeaderboardPage />, {
        title: "St Paul's League",
        description: "Track upcoming fixtures, past results, player statistics, and current league standings for St Paul's Pool League.",
        script: '/js/leaderboard.js'
    });
});

web.get('/about', (c) => {
    return c.render(<AboutPage />, {
        title: "About - St Paul's League",
        description: "Learn about St Paul's Pool League, competition rules, match format, scoring system, and community information."
    });
});

web.get('/game-list', (c) => {
    return c.render(<GamesPage isAuthenticated={c.get('isAuthenticated')} />, {
        title: "Game History - St Paul's League",
        description: "Browse the complete match history, scores, and head-to-head game results for St Paul's Pool League.",
        script: '/js/game-list.js'
    });
});

web.get('/outstanding-games', (c) => {
    const roundsParam = c.req.query('rounds');
    const rounds = roundsParam ? parseInt(roundsParam, 10) : 2;
    return c.render(
        <OutstandingGamesPage rounds={isNaN(rounds) || rounds < 1 ? 2 : rounds} isAuthenticated={c.get('isAuthenticated')} />,
        {
            title: "Outstanding Games - St Paul's League",
            description: "View unplayed matches, round fixtures, and upcoming games that need to be played in St Paul's Pool League.",
            script: '/js/outstanding-games.js'
        }
    );
});

web.get('/seasons', (c) => {
    return c.render(<SeasonsPage />, {
        title: "Season Archive - St Paul's League",
        description: "Explore previous seasons, historical tournament records, and past league tables for St Paul's Pool League.",
        script: '/js/seasons.js'
    });
});

web.get('/archive', (c) => {
    return c.redirect('/seasons', 301);
});

web.get('/archive/all-time', (c) => {
    return c.render(<AllTimeLeaderboardPage />, {
        title: "All-Time Standings - St Paul's League",
        description: "Check all-time pool rankings, career win/loss records, total points, and player stats in St Paul's League history.",
        script: '/js/all-time-leaderboard.js'
    });
});

web.get('/all-time', (c) => {
    return c.redirect('/archive/all-time', 301);
});

web.get('/archive/:seasonId', (c) => {
    const { seasonId } = c.req.param();
    return c.render(<ArchivedLeaderboardPage seasonId={seasonId} />, {
        title: `Season ${seasonId} Archive - St Paul's League`,
        description: `View final standings, match results, and player statistics for Season ${seasonId} of St Paul's Pool League.`,
        script: '/js/archived-leaderboard.js'
    });
});

web.get('/privacy-policy', (c) => {
    return c.render(<PrivacyPolicyPage />, {
        title: "Privacy Policy - St Paul's League",
        description: "Read the Privacy Policy for St Paul's League, explaining how player data and account information are collected and protected."
    });
});

web.get('/privacy', (c) => {
    return c.redirect('/privacy-policy', 301);
});

web.get('/terms-of-service', (c) => {
    return c.render(<TermsOfServicePage />, {
        title: "Terms of Service - St Paul's League",
        description: "Review the Terms of Service and community guidelines for participating in the St Paul's Pool League."
    });
});

web.get('/terms', (c) => {
    return c.redirect('/terms-of-service', 301);
});

// --- Protected Routes ---
web.get('/log-game', protectWeb, (c) => {
    return c.render(<LogGamePage />, {
        title: "Log a Game - St Paul's League",
        robots: 'noindex, nofollow',
        script: '/js/log-game.js'
    });
});

web.get('/audit-log', protectWeb, (c) => {
    return c.render(<AuditPage />, {
        title: "Audit Log - St Paul's League",
        robots: 'noindex, nofollow',
        script: '/js/audit-log.js',
        style: '/css/audit-log.css'
    });
});

web.get('/profile', protectWeb, (c) => {
    return c.render(<CustomizePage />, {
        title: "Customise Profile - St Paul's League",
        robots: 'noindex, nofollow',
        script: '/js/customize.js'
    });
});

web.get('/edit-game', protectWeb, (c) => {
    return c.render(<EditGamePage />, {
        title: "Edit Game - St Paul's League",
        robots: 'noindex, nofollow',
        script: '/js/edit-game.js',
        style: '/css/edit-game.css'
    });
});

// Admin-only route
web.get('/admin-panel', protectAdminWeb, (c) => {
    return c.render(<AdminPage />, {
        title: "Admin Panel - St Paul's League",
        robots: 'noindex, nofollow',
        script: '/js/admin-panel.js'
    });
});

// --- 404 Handler ---
web.notFound((c) => {
    c.status(404);
    return c.render(<NotFoundPage />, {
        title: "Page Not Found - St Paul's League",
        description: "The page you are looking for does not exist or may have been moved.",
        robots: 'noindex, nofollow'
    });
});

export default web;