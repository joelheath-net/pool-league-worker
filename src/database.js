// --- Case Conversion Helpers ---

const toCamel = (s) => s.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const keysToCamel = (obj) => {
    if (obj === null || obj === undefined)
        return obj;

    if (Array.isArray(obj))
        return obj.map(v => keysToCamel(v));

    if (typeof obj === 'object')
        return Object.keys(obj).reduce((acc, key) => {
            acc[toCamel(key)] = keysToCamel(obj[key]);
            return acc;
        }, {});

    if (!['string', 'number', 'boolean'].includes(typeof obj))
        console.warn('`keysToCamel` received unexpected value:', obj);

    return obj;
};

// --- User Functions ---

export const getUsers = async (db) => {
    const { results } = await db.prepare('SELECT id, name, team, team_color FROM users').all();
    return keysToCamel(results);
};

export const getSensitiveUsers = async (db) => {
    const { results } = await db.prepare('SELECT id, name, email FROM users').all();
    return keysToCamel(results);
};

export const userExists = async (db, id) => {
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    return !!user;
}

export const getUserById = async (db, id) => {
    const user = await db.prepare('SELECT id, name, team, team_color FROM users WHERE id = ?').bind(id).first();
    return keysToCamel(user);
};

export const getUserByIdSensitive = async (db, id) => {
    const user = await db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').bind(id).first();
    return keysToCamel(user);
};

export const updateProfile = async (db, userId, { name, team, teamColor }) => {
    return await db.prepare('UPDATE users SET name = ?, team = ?, team_color = ? WHERE id = ?')
        .bind(name, team, teamColor, userId)
        .run();
};

export const deleteUser = async (db, userId) => {
    return await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

export const findOrCreateUser = async (db, googleUser, tokens) => {
    let user = await getUserByIdSensitive(db, googleUser.sub);

    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

    if (!user) {
        user = {
            id: googleUser.sub,
            name: googleUser.name,
            email: googleUser.email,
        };
        await db.prepare(
            'INSERT INTO users (id, name, email, google_access_token, google_access_token_expires_at, google_refresh_token) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
            user.id,
            user.name,
            user.email,
            tokens.access_token,
            expiresAt,
            tokens.refresh_token // This will be stored only on the first login
        ).run();
    } else {
        // User exists, update tokens. Refresh token is only sent on first approval, so only update it if we get a new one.
        const updateFields = ['google_access_token = ?', 'google_access_token_expires_at = ?'];
        const params = [tokens.access_token, expiresAt];

        if (tokens.refresh_token) {
            updateFields.push('google_refresh_token = ?');
            params.push(tokens.refresh_token);
        }
        
        params.push(user.id);

        await db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).bind(...params).run();
    }

    return user;
};

// VERY SENSITIVE, DO NOT EXPOSE REFRESH TOKEN
export const getUserForRefresh = async (db, userId) => {
    const user = await db.prepare('SELECT id, email, role, google_refresh_token FROM users WHERE id = ?').bind(userId).first();
    return keysToCamel(user);
};

export const updateUserTokens = async (db, userId, accessToken, expiresIn) => {
    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
    return await db.prepare(
        'UPDATE users SET google_access_token = ?, google_access_token_expires_at = ? WHERE id = ?'
    ).bind(accessToken, expiresAt, userId).run();
};

// --- Game Functions ---

export const createGameRevision = async (db, { winner, loser, ballsRemaining, fouledOnBlack, date, authorId }) => {
    const player1Id = winner < loser ? winner : loser;
    const player2Id = winner < loser ? loser : winner;

    const latestRematch = await db.prepare(
        `SELECT rematch_id FROM game_revisions WHERE player1_id = ? AND player2_id = ? ORDER BY rematch_id DESC LIMIT 1`
    ).bind(player1Id, player2Id).first();
    const rematchId = latestRematch ? keysToCamel(latestRematch).rematchId + 1 : 0;

    return await db.prepare(
        `INSERT INTO game_revisions (player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(player1Id, player2Id, rematchId, winner, ballsRemaining, fouledOnBlack, date, authorId, new Date().toISOString()).run();
};

export const getGameList = async (db) => {
    const { results } = await db.prepare(`
        WITH RankedRevisions AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY player1_id, player2_id, rematch_id ORDER BY revision_id DESC) as rn
            FROM game_revisions
        )
        SELECT * FROM RankedRevisions WHERE rn = 1 ORDER BY played_at DESC, player1_id, player2_id, rematch_id DESC
    `).all();
    return keysToCamel(results);
};

export const getAuditLog = async (db) => {
    const { results } = await db.prepare('SELECT * FROM game_revisions ORDER BY authored_at DESC').all();
    return keysToCamel(results);
};

export const getGameByCompositeId = async (db, player1Id, player2Id, rematchId) => {
    const game = await db.prepare(
      `SELECT * FROM game_revisions
       WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
       ORDER BY revision_id DESC
       LIMIT 1`
    ).bind(player1Id, player2Id, rematchId).first();
    return keysToCamel(game);
};

export const updateGame = async (db, { player1Id, player2Id, rematchId, winnerId, ballsRemaining, fouledOnBlack, playedAt, authorId }) => {
    const latestRevisionResult = await db.prepare(
        `SELECT revision_id FROM game_revisions
         WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
         ORDER BY revision_id DESC LIMIT 1`
    ).bind(player1Id, player2Id, rematchId).first();

    if (!latestRevisionResult) {
        throw new Error('Cannot update a game that does not exist.');
    }
    const latestRevision = keysToCamel(latestRevisionResult);

    const newRevisionId = latestRevision.revisionId + 1;
    return await db.prepare(
        `INSERT INTO game_revisions (revision_id, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newRevisionId, player1Id, player2Id, rematchId, winnerId, ballsRemaining, fouledOnBlack, playedAt, authorId, new Date().toISOString()).run();
};

export const getLeaderboardStats = async (db) => {
    const games = await getGameList(db);

    const { results } = await db.prepare('SELECT id FROM users').all();
    const players = new Map(results.map(p => [p.id, { wins: 0, losses: 0, ballsRemaining: 0, foulsOnBlack: 0 }]));

    for (const game of games) {
        const { player1Id, player2Id, winnerId, ballsRemaining, fouledOnBlack } = game;
        const winner = winnerId;
        const loser = winnerId === player1Id ? player2Id : player1Id;

        if (players.has(winner)) players.get(winner).wins++;
        if (players.has(loser)) {
            players.get(loser).losses++;
            players.get(loser).ballsRemaining += ballsRemaining;
            if (fouledOnBlack) players.get(loser).foulsOnBlack++;
        }
    }
    return Array.from(players.entries()).map(([playerId, stats]) => ({ playerId, ...stats }));
};


// --- Admin Functions ---

export const resetGames = async (db) => {
    return await db.prepare('DELETE FROM game_revisions').run();
};

export const importGames = async (db, gamesToProcess) => {
    const statements = await Promise.all(gamesToProcess.map(async (game) => {
        const latestRevision = await db.prepare(
            `SELECT revision_id FROM game_revisions
             WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
             ORDER BY revision_id DESC LIMIT 1`
        ).bind(game.player1Id, game.player2Id, game.rematchId).first();

        const newRevisionId = latestRevision ? latestRevision.revisionId + 1 : 0;
        
        return db.prepare(
            `INSERT INTO game_revisions (revision_id, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            newRevisionId,
            game.player1Id,
            game.player2Id,
            game.rematchId,
            game.winnerId,
            game.ballsRemaining,
            game.fouledOnBlack,
            game.playedAt,
            game.authorId,
            game.authoredAt
        );
    }));

    if (statements.length > 0) {
        await db.batch(statements);
    }
    return statements.length;
};


// --- Archive Functions ---

export const getArchivedLeaderboard = async (db, seasonId) => {
    const { results } = await db.prepare(`
        SELECT
            a.player_id,
            u.name,
            u.team,
            u.team_color,
            a.wins,
            a.losses,
            a.balls_remaining,
            a.fouls_on_black,
            a.points
        FROM archived_tables a
        JOIN users u ON a.player_id = u.id
        WHERE a.season_id = ?
    `).bind(seasonId).all();
    return keysToCamel(results);
};

export const getArchivedSeasonInfo = async (db, seasonId) => {
    return await db.prepare('SELECT id, name FROM archived_seasons WHERE id = ?').bind(seasonId).first();
}

export const archiveSeason = async (db, seasonName) => {
    // 1. Get the current leaderboard stats
    const leaderboardStats = await getLeaderboardStats(db);
    if (leaderboardStats.length === 0) {
        throw new Error("Cannot archive an empty season.");
    }

    // 2. Process stats to calculate points
    const processedStats = leaderboardStats.map(playerStats => {
        const points = playerStats.wins * 3 + playerStats.losses - playerStats.foulsOnBlack;
        return { ...playerStats, points };
    });

    // 3. Create a new season entry and get its ID
    const seasonId = (await db.prepare(
            'INSERT INTO archived_seasons (name) VALUES (?)'
        ).bind(seasonName).run())
        .meta.last_row_id;

    console.log(seasonId);

    console.log(processedStats);

    // 4. Prepare statements to insert leaderboard data
    const insertStatements = processedStats.map(stats => {
        return db.prepare(
            `INSERT INTO archived_tables (season_id, player_id, points, wins, losses, fouls_on_black, balls_remaining)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            seasonId,
            stats.playerId,
            stats.points,
            stats.wins,
            stats.losses,
            stats.foulsOnBlack,
            stats.ballsRemaining
        );
    });

    // 5. Prepare statement to clear current games
    const clearGamesStatement = db.prepare('DELETE FROM game_revisions');

    // 6. Batch all operations together in a transaction
    await db.batch([
        ...insertStatements,
        clearGamesStatement
    ]);

    return { newSeasonId: seasonId };
};