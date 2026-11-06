import { Hono } from 'hono';
import * as db from '../database.js';
import { calculateOutstandingGames } from '../scheduler.js';

const publicApi = new Hono();

publicApi.get('/users/:id', async (c) => {
    const { id } = c.req.param();
    const user = await db.getUserById(c.env.DB, id);
    if (!user) return c.json({ message: 'User not found' }, 404);
    return c.json(user);
});

publicApi.get('/users', async (c) => {
    const participatingOnly = c.req.query('participating') === 'true';
    const users = await db.getUsers(c.env.DB, { participatingOnly });
    return c.json(users);
});

publicApi.get('/leaderboard', async (c) => {
    const stats = await db.getLeaderboardStats(c.env.DB);
    return c.json(stats);
});

publicApi.get('/game-list', async (c) => {
    const games = await db.getGameList(c.env.DB);
    return c.json(games);
});

publicApi.get('/outstanding-games', async (c) => {
    const roundsParam = c.req.query('rounds');
    let rematchRounds = 2;
    if (roundsParam !== undefined) {
        if (!/^[1-9]\d*$/.test(roundsParam)) {
            return c.json({ message: 'Rematch rounds must be a positive integer of at least 1.' }, 400);
        }
        rematchRounds = Number(roundsParam);
        if (!Number.isSafeInteger(rematchRounds) || rematchRounds > 99) {
            return c.json({ message: 'Rematch rounds exceeds maximum allowed limit of 99.' }, 400);
        }
    }

    const prioritiseParam = c.req.query('prioritiseFirstMatchups');
    let prioritiseFirstMatchups = true;
    if (prioritiseParam !== undefined) {
        if (prioritiseParam === 'true' || prioritiseParam === '1') {
            prioritiseFirstMatchups = true;
        } else if (prioritiseParam === 'false' || prioritiseParam === '0') {
            prioritiseFirstMatchups = false;
        } else {
            return c.json({ message: 'Invalid prioritiseFirstMatchups parameter.' }, 400);
        }
    }

    try {
        const [users, games] = await Promise.all([
            db.getUsers(c.env.DB, { participatingOnly: true }),
            db.getGameList(c.env.DB)
        ]);

        let availablePlayerIds = null;
        if (c.req.query('available') !== undefined) {
            const rawAvailable = c.req.queries('available') || [];
            availablePlayerIds = rawAvailable
                .flatMap((val) => String(val).split(','))
                .map((s) => s.trim())
                .filter(Boolean);
        } else if (c.req.query('unavailable') !== undefined) {
            const rawUnavailable = c.req.queries('unavailable') || [];
            const unavailableSet = new Set(
                rawUnavailable
                    .flatMap((val) => String(val).split(','))
                    .map((s) => s.trim())
                    .filter(Boolean)
            );
            availablePlayerIds = users.filter((u) => !unavailableSet.has(u.id)).map((u) => u.id);
        }

        const result = calculateOutstandingGames({
            users,
            games,
            rematchRounds,
            prioritiseFirstMatchups,
            availablePlayerIds,
            limit: 50
        });

        return c.json(result);
    } catch (error) {
        return c.json({ message: error.message || 'Failed to calculate outstanding games.' }, 400);
    }
});

publicApi.get('/all-time-leaderboard', async (c) => {
    const leaderboard = await db.getAllTimeLeaderboardStats(c.env.DB);
    return c.json(leaderboard);
});

publicApi.get('/archive/all-time', async (c) => {
    const leaderboard = await db.getAllTimeLeaderboardStats(c.env.DB);
    return c.json(leaderboard);
});

publicApi.get('/archive/:seasonId', async (c) => {
    const { seasonId } = c.req.param();
    const seasonInfo = await db.getArchivedSeasonInfo(c.env.DB, seasonId);
    const leaderboard = await db.getArchivedLeaderboard(c.env.DB, seasonId);

    if (!seasonInfo) {
        return c.json({ error: 'Archive not found' }, 404);
    }

    return c.json({ seasonInfo, leaderboard });
});

publicApi.get('/seasons', async (c) => {
    const seasons = await db.getArchivedSeasons(c.env.DB);
    return c.json(seasons);
});

publicApi.get('/push-config', (c) => {
    return c.json({
        publicKey: c.env.VAPID_PUBLIC_KEY || ''
    });
});

publicApi.post('/push-unsubscribe', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        if (body?.endpoint) {
            await db.deletePushSubscription(c.env.DB, body.endpoint);
        }
        return c.json({ message: 'Unsubscribed successfully' });
    } catch (e) {
        return c.json({ message: 'Failed to unsubscribe' }, 500);
    }
});

export default publicApi;
