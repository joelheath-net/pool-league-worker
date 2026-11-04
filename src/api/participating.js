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

const REQUIRED_GAME_FIELDS = [
    'homePlayerId',
    'awayPlayerId',
    'winnerHome',
    'ballsRemaining',
    'fouledOnBlack',
    'playedAt'
];

const ALLOWED_GAME_FIELDS = new Set(REQUIRED_GAME_FIELDS);

export function parseGameIdParam(rawId) {
    if (typeof rawId !== 'string' || !/^[1-9]\d*$/.test(rawId)) {
        return null;
    }
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id < 1) {
        return null;
    }
    return id;
}

export function isValidPlayedAtDate(dateStr) {
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return false;
    }

    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (year < 2000) {
        return false;
    }

    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== month - 1 ||
        utcDate.getUTCDate() !== day
    ) {
        return false;
    }

    // Allow up to +24h ahead of UTC for local timezones ahead of UTC
    const maxAllowedMs = Date.now() + 24 * 60 * 60 * 1000;
    if (utcDate.getTime() > maxAllowedMs) {
        return false;
    }

    return true;
}

export function validateGamePayload(gameData) {
    if (!gameData || typeof gameData !== 'object' || Array.isArray(gameData)) {
        return { valid: false, message: 'Invalid game data format' };
    }

    for (const key of Object.keys(gameData)) {
        if (!ALLOWED_GAME_FIELDS.has(key)) {
            return { valid: false, message: `Unexpected field: ${key}` };
        }
    }

    for (const field of REQUIRED_GAME_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(gameData, field)) {
            return { valid: false, message: `Missing required field: ${field}` };
        }
    }

    if (
        typeof gameData.homePlayerId !== 'string' ||
        !gameData.homePlayerId.trim() ||
        gameData.homePlayerId !== gameData.homePlayerId.trim() ||
        gameData.homePlayerId.length > 128
    ) {
        return { valid: false, message: 'homePlayerId must be a valid non-empty string ID' };
    }

    if (
        typeof gameData.awayPlayerId !== 'string' ||
        !gameData.awayPlayerId.trim() ||
        gameData.awayPlayerId !== gameData.awayPlayerId.trim() ||
        gameData.awayPlayerId.length > 128
    ) {
        return { valid: false, message: 'awayPlayerId must be a valid non-empty string ID' };
    }

    if (gameData.homePlayerId === gameData.awayPlayerId) {
        return { valid: false, message: 'Home player and away player cannot be the same' };
    }

    if (typeof gameData.winnerHome !== 'boolean') {
        return { valid: false, message: 'winnerHome must be a boolean value' };
    }

    if (
        typeof gameData.ballsRemaining !== 'number' ||
        !Number.isInteger(gameData.ballsRemaining) ||
        gameData.ballsRemaining < 0 ||
        gameData.ballsRemaining > 8
    ) {
        return { valid: false, message: 'Balls remaining must be an integer between 0 and 8' };
    }

    if (typeof gameData.fouledOnBlack !== 'boolean') {
        return { valid: false, message: 'Fouled on black must be a boolean value' };
    }

    if (!isValidPlayedAtDate(gameData.playedAt)) {
        return { valid: false, message: 'Invalid playedAt date. Must be a real calendar date in YYYY-MM-DD format and not in the future' };
    }

    return { valid: true };
}

function runBackgroundTask(c, taskPromise) {
    try {
        c.executionCtx.waitUntil(taskPromise);
    } catch {
        taskPromise.catch((err) => console.error('[Push] Notify error:', err));
    }
}

const handleCreateGame = async (c) => {
    const userPayload = c.get('user');

    let gameData;
    try {
        gameData = await c.req.json();
    } catch {
        return c.json({ message: 'Invalid JSON request body' }, 400);
    }

    const validation = validateGamePayload(gameData);
    if (!validation.valid) {
        return c.json({ message: validation.message }, 400);
    }

    const [homeUser, awayUser] = await Promise.all([
        db.getUserById(c.env.DB, gameData.homePlayerId),
        db.getUserById(c.env.DB, gameData.awayPlayerId)
    ]);

    if (!homeUser) return c.json({ message: 'Home player does not exist' }, 404);
    if (!awayUser) return c.json({ message: 'Away player does not exist' }, 404);

    if (!homeUser.participating || !awayUser.participating) {
        return c.json({ message: 'Both players must be active participating players to log a game' }, 400);
    }

    const prevRanks = await getLeaderboardRanks(c.env.DB);
    const { gameId } = await db.createGame(c.env.DB, {
        ...gameData,
        authorId: userPayload.sub
    });
    const newRanks = await getLeaderboardRanks(c.env.DB);
    const rankChanges = diffRankings(prevRanks, newRanks);

    if (rankChanges.length > 0) {
        runBackgroundTask(c, notifyRankChanges(c.env, rankChanges));
    }

    return c.json({ message: 'Game logged successfully', gameId }, 201);
};

participatingApi.post('/games', handleCreateGame);
participatingApi.post('/log-game', handleCreateGame);

participatingApi.get('/games/:gameId', async (c) => {
    const gameId = parseGameIdParam(c.req.param('gameId'));
    if (gameId === null) {
        return c.json({ message: 'Invalid game ID' }, 400);
    }

    const game = await db.getGameById(c.env.DB, gameId);
    if (!game) {
        return c.json({ message: 'Game not found' }, 404);
    }

    return c.json(game);
});

participatingApi.patch('/games/:gameId', async (c) => {
    const gameId = parseGameIdParam(c.req.param('gameId'));
    if (gameId === null) {
        return c.json({ message: 'Invalid game ID' }, 400);
    }

    const userPayload = c.get('user');

    let gameData;
    try {
        gameData = await c.req.json();
    } catch {
        return c.json({ message: 'Invalid JSON request body' }, 400);
    }

    const validation = validateGamePayload(gameData);
    if (!validation.valid) {
        return c.json({ message: validation.message }, 400);
    }

    const existingGame = await db.getGameById(c.env.DB, gameId);
    if (!existingGame) {
        return c.json({ message: 'Game not found' }, 404);
    }

    if (
        gameData.homePlayerId !== existingGame.homePlayerId ||
        gameData.awayPlayerId !== existingGame.awayPlayerId
    ) {
        return c.json({ message: 'Players of an existing game cannot be changed' }, 400);
    }

    try {
        const prevRanks = await getLeaderboardRanks(c.env.DB);
        await db.updateGame(c.env.DB, gameId, {
            winnerHome: gameData.winnerHome,
            ballsRemaining: gameData.ballsRemaining,
            fouledOnBlack: gameData.fouledOnBlack,
            playedAt: gameData.playedAt,
            authorId: userPayload.sub
        });
        const newRanks = await getLeaderboardRanks(c.env.DB);
        const rankChanges = diffRankings(prevRanks, newRanks);

        if (rankChanges.length > 0) {
            runBackgroundTask(c, notifyRankChanges(c.env, rankChanges));
        }

        return c.json({ message: 'Game updated successfully by creating a new revision.', gameId }, 200);
    } catch (error) {
        if (error.message.includes('does not exist')) {
            return c.json({ message: error.message }, 404);
        }
        console.error('Error updating game:', error);
        return c.json({ message: 'An internal error occurred.' }, 500);
    }
});

participatingApi.delete('/games/:gameId', async (c) => {
    const gameId = parseGameIdParam(c.req.param('gameId'));
    if (gameId === null) {
        return c.json({ message: 'Invalid game ID' }, 400);
    }

    const userPayload = c.get('user');

    try {
        const prevRanks = await getLeaderboardRanks(c.env.DB);
        const { deleted } = await db.deleteGame(c.env.DB, gameId, {
            authorId: userPayload.sub
        });

        if (!deleted) {
            return c.json({ message: 'Game not found' }, 404);
        }

        const newRanks = await getLeaderboardRanks(c.env.DB);
        const rankChanges = diffRankings(prevRanks, newRanks);

        if (rankChanges.length > 0) {
            runBackgroundTask(c, notifyRankChanges(c.env, rankChanges));
        }

        return c.json({ message: 'Game deleted successfully.', gameId }, 200);
    } catch (error) {
        console.error('Error deleting game:', error);
        return c.json({ message: 'An internal error occurred.' }, 500);
    }
});

export default participatingApi;
