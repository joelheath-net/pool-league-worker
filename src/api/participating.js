import { Hono } from 'hono';
import { protectParticipatingAPI } from '../middleware.js';
import * as db from '../database.js';
import {
    getLeaderboardRanks,
    diffRankings,
    notifyRankChanges
} from '../push-service.js';

const participatingApi = new Hono();

participatingApi.use('*', protectParticipatingAPI);

function validateFields(fields, data) {
    for (const field of fields) {
        if (!data.hasOwnProperty(field)) {
            return { valid: false, message: `Missing required field: ${field}` };
        }
    }
    return { valid: true };
}

participatingApi.post('/log-game', async (c) => {
    const userPayload = c.get('user');
    const gameData = await c.req.json();

    // Input validation
    if (!gameData || typeof gameData !== 'object') return c.json({ message: 'Invalid game data format' }, 400);

    const requiredFields = ['winner', 'loser', 'ballsRemaining', 'fouledOnBlack', 'date'];
    const validation = validateFields(requiredFields, gameData);
    if (!validation.valid) return c.json({ message: validation.message }, 400);

    if (gameData.winner === gameData.loser) return c.json({ message: 'Winner and loser cannot be the same' }, 400);
    const winnerUser = await db.getUserById(c.env.DB, gameData.winner);
    if (!winnerUser) return c.json({ message: 'Winner does not exist' }, 404);
    const loserUser = await db.getUserById(c.env.DB, gameData.loser);
    if (!loserUser) return c.json({ message: 'Loser does not exist' }, 404);

    if (!winnerUser.participating || !loserUser.participating) {
        return c.json({ message: 'Both players must be active participating players to log a game' }, 400);
    }

    if (typeof gameData.ballsRemaining !== 'number' || isNaN(gameData.ballsRemaining) || gameData.ballsRemaining < 0 || gameData.ballsRemaining > 8)
        return c.json({ message: 'Balls remaining must be a number between 0 and 8' }, 400);
    if (typeof gameData.fouledOnBlack !== 'boolean')
        return c.json({ message: 'Fouled on black must be a boolean value' }, 400);
    if (isNaN(Date.parse(gameData.date)))
        return c.json({ message: 'Invalid date format' }, 400);

    // Add author from the authenticated user context
    gameData.authorId = userPayload.sub;

    const prevRanks = await getLeaderboardRanks(c.env.DB);
    await db.createGameRevision(c.env.DB, gameData);
    const newRanks = await getLeaderboardRanks(c.env.DB);
    const rankChanges = diffRankings(prevRanks, newRanks);

    if (rankChanges.length > 0) {
        const notifyTask = notifyRankChanges(c.env, rankChanges);
        if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
            c.executionCtx.waitUntil(notifyTask);
        } else {
            notifyTask.catch((err) => console.error('[Push] Notify error:', err));
        }
    }

    return c.json({ message: 'Game logged successfully' }, 201);
});

participatingApi.get('/games/:player1Id/:player2Id/:rematchId', async (c) => {
    let { player1Id, player2Id, rematchId } = c.req.param();
    if (player1Id > player2Id) [player1Id, player2Id] = [player2Id, player1Id];

    const game = await db.getGameByCompositeId(c.env.DB, player1Id, player2Id, rematchId);
    if (!game) return c.json({ message: 'Game not found' }, 404);
    return c.json(game);
});

participatingApi.patch('/game', async (c) => {
    const userPayload = c.get('user');
    const gameData = await c.req.json();

    // Input validation
    if (!gameData || typeof gameData !== 'object') return c.json({ message: 'Invalid game data format' }, 400);

    const requiredFields = ['player1Id', 'player2Id', 'rematchId', 'winnerId', 'ballsRemaining', 'fouledOnBlack', 'playedAt'];
    const validation = validateFields(requiredFields, gameData);
    if (!validation.valid) return c.json({ message: validation.message }, 400);

    if (gameData.player1Id === gameData.player2Id) return c.json({ message: 'Winner and loser cannot be the same' }, 400);
    if (!(await db.userExists(c.env.DB, gameData.player1Id))) return c.json({ message: 'Player 1 does not exist' }, 404);
    if (!(await db.userExists(c.env.DB, gameData.player2Id))) return c.json({ message: 'Player 2 does not exist' }, 404);

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
        const prevRanks = await getLeaderboardRanks(c.env.DB);
        await db.updateGame(c.env.DB, gameData);
        const newRanks = await getLeaderboardRanks(c.env.DB);
        const rankChanges = diffRankings(prevRanks, newRanks);

        if (rankChanges.length > 0) {
            const notifyTask = notifyRankChanges(c.env, rankChanges);
            if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
                c.executionCtx.waitUntil(notifyTask);
            } else {
                notifyTask.catch((err) => console.error('[Push] Notify error:', err));
            }
        }

        return c.json({ message: 'Game updated successfully by creating a new revision.' }, 200);
    } catch (error) {
        if (error.message.includes('does not exist')) {
            return c.json({ message: error.message }, 404);
        }
        console.error('Error updating game:', error);
        return c.json({ message: 'An internal error occurred.' }, 500);
    }
});

export default participatingApi;
