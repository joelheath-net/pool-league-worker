import { Hono } from 'hono';
import { protectAPI } from './middleware.js';
import * as db from './database.js';

const api = new Hono();

// --- UTILITY ---
function validateFields(fields, data) {
    for (const field of fields) {
        if (!data.hasOwnProperty(field)) {
            return { valid: false, message: `Missing required field: ${field}` };
        }
    }
    return { valid: true };
}

// --- PUBLIC ROUTES ---

api.get('/users/:id', async (c) => {
    const { id } = c.req.param();
    const user = await db.getUserById(c.env.DB, id);
    if (!user) return c.json({ message: 'User not found' }, 404);
    return c.json(user);
});

api.get('/users', async (c) => {
    const users = await db.getUsers(c.env.DB);
    return c.json(users);
});

api.get('/leaderboard', async (c) => {
    const stats = await db.getLeaderboardStats(c.env.DB);
    return c.json(stats);
});

api.get('/game-list', async (c) => {
    const games = await db.getGameList(c.env.DB);
    return c.json(games);
});

api.get('/archive/:seasonId', async (c) => {
    const { seasonId } = c.req.param();
    const seasonInfo = await db.getArchivedSeasonInfo(c.env.DB, seasonId);
    const leaderboard = await db.getArchivedLeaderboard(c.env.DB, seasonId);

    if (!seasonInfo) {
        return c.json({ error: 'Archive not found' }, 404);
    }

    return c.json({ seasonInfo, leaderboard });
});

// --- AUTHENTICATED ROUTES ---

api.get('/users-sensitive', protectAPI, async (c) => {
    const users = await db.getSensitiveUsers(c.env.DB);
    return c.json(users);
});

api.get('/profile', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    if (!userPayload) return c.json({ message: 'Unauthorized' }, 401);
    
    return c.json(await db.getUserById(c.env.DB, userPayload.sub));
});

api.patch('/profile', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const profileData = await c.req.json();

    if (!/^#[0-9a-fA-F]{6}$/.test(profileData.teamColor)) {
        return c.json({ message: 'Invalid team color format. Must be hex color codes in format #RRGGBB' }, 400);
    }

    await db.updateProfile(c.env.DB, userPayload.sub, profileData);
    return c.json({ message: 'Profile updated successfully' });
});

api.post('/log-game', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const gameData = await c.req.json();
    
    // Input validation
    if (!gameData || typeof gameData !== 'object') return c.json({ message: 'Invalid game data format' }, 400);

    const requiredFields = ['winner', 'loser', 'ballsRemaining', 'fouledOnBlack', 'date'];
    const validation = validateFields(requiredFields, gameData);
    if (!validation.valid) return c.json({ message: validation.message }, 400);
    
    if (gameData.winner === gameData.loser) return c.json({ message: 'Winner and loser cannot be the same' }, 400);
    if (!db.userExists(c.env.DB, gameData.winner)) return c.json({ message: 'Winner does not exist' }, 404);
    if (!db.userExists(c.env.DB, gameData.loser)) return c.json({ message: 'Loser does not exist' }, 404);

    if (typeof gameData.ballsRemaining !== 'number' || isNaN(gameData.ballsRemaining) || gameData.ballsRemaining < 0 || gameData.ballsRemaining > 8)
        return c.json({ message: 'Balls remaining must be a number between 0 and 8' }, 400);
    if (typeof gameData.fouledOnBlack !== 'boolean')
        return c.json({ message: 'Fouled on black must be a boolean value' }, 400);
    if (isNaN(Date.parse(gameData.date)))
        return c.json({ message: 'Invalid date format' }, 400);

    // Add author from the authenticated user context
    gameData.authorId = userPayload.sub;

    await db.createGameRevision(c.env.DB, gameData);
    return c.json({ message: 'Game logged successfully' }, 201);
});

api.get('/audit-log', protectAPI, async (c) => {
    const revisions = await db.getAuditLog(c.env.DB);
    return c.json(revisions);
});

api.get('/games/:player1Id/:player2Id/:rematchId', protectAPI, async (c) => {
    let { player1Id, player2Id, rematchId } = c.req.param();
    if (player1Id > player2Id) [player1Id, player2Id] = [player2Id, player1Id];

    const game = await db.getGameByCompositeId(c.env.DB, player1Id, player2Id, rematchId);
    if (!game) return c.json({ message: 'Game not found' }, 404);
    return c.json(game);
});

api.patch('/game', protectAPI, async (c) => {
    const userPayload = await c.get('user');
    const gameData = await c.req.json();

    // Input validation
    if (!gameData || typeof gameData !== 'object') return c.json({ message: 'Invalid game data format' }, 400);

    const requiredFields = ['player1Id', 'player2Id', 'rematchId', 'winnerId', 'ballsRemaining', 'fouledOnBlack', 'playedAt'];
    const validation = validateFields(requiredFields, gameData);
    if (!validation.valid) return c.json({ message: validation.message }, 400);

    if (gameData.player1Id === gameData.player2Id) return c.json({ message: 'Winner and loser cannot be the same' }, 400);
    if (!db.userExists(c.env.DB, gameData.player1Id)) return c.json({ message: 'Player 1 does not exist' }, 404);
    if (!db.userExists(c.env.DB, gameData.player2Id)) return c.json({ message: 'Player 2 does not exist' }, 404);

    console.log(gameData);
    if (typeof gameData.rematchId !== 'number' || !Number.isInteger(gameData.rematchId) || gameData.rematchId < 0)
        return c.json({ message: 'Rematch ID must be a non-negative integer' }, 400);
    if (typeof gameData.ballsRemaining !== 'number' || !Number.isInteger(gameData.ballsRemaining) || gameData.ballsRemaining < 0 || gameData.ballsRemaining > 8)
        return c.json({ message: 'Balls remaining must be a number between 0 and 8' }, 400);
    if (typeof gameData.fouledOnBlack !== 'boolean')
        return c.json({ message: 'Fouled on black must be a boolean value' }, 400);
    if (isNaN(Date.parse(gameData.playedAt)))
        return c.json({ message: 'Invalid date format' }, 400);

    gameData.authorId = userPayload.sub;

    try {
        await db.updateGame(c.env.DB, gameData);
        return c.json({ message: 'Game updated successfully by creating a new revision.' }, 200);
    } catch (error) {
        if (error.message.includes('does not exist')) {
            return c.json({ message: error.message }, 404);
        }
        console.error('Error updating game:', error);
        return c.json({ message: 'An internal error occurred.' }, 500);
    }
});

export default api;