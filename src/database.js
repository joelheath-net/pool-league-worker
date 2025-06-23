// --- User Functions ---

export const getUsers = async (db) => {
    const { results } = await db.prepare('SELECT id, name, team, team_color FROM users').all();
    return results;
};

export const getSensitiveUsers = async (db) => {
    const { results } = await db.prepare('SELECT id, name, email FROM users').all();
    return results;
};

export const userExists = async (db, id) => {
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    return !!user;
}

export const getUserById = async (db, id) => {
    return await db.prepare('SELECT id, name, team, team_color FROM users WHERE id = ?').bind(id).first();
};

export const getSensitiveUserById = async (db, id) => {
    return await db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').bind(id).first();
};

export const getProfile = async (db, userId) => {
    return await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
};

export const updateProfile = async (db, userId, { name, team, team_color }) => {
    return await db.prepare('UPDATE users SET name = ?, team = ?, team_color = ? WHERE id = ?')
        .bind(name, team, team_color, userId)
        .run();
};

export const deleteUser = async (db, userId) => {
    return await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

export const findOrCreateUser = async (db, googleUser, tokens) => {
    let user = await getSensitiveUserById(db, googleUser.sub);

    const expires_at = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

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
            expires_at,
            tokens.refresh_token // This will be stored only on the first login
        ).run();
    } else {
        // User exists, update tokens. Refresh token is only sent on first approval, so only update it if we get a new one.
        const updateFields = ['google_access_token = ?', 'google_access_token_expires_at = ?'];
        const params = [tokens.access_token, expires_at];

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
    return await db.prepare('SELECT id, email, role, google_refresh_token FROM users WHERE id = ?').bind(userId).first();
};

export const updateUserTokens = async (db, userId, { access_token, expires_in }) => {
    const expires_at = new Date(Date.now() + (expires_in * 1000)).toISOString();
    return await db.prepare(
        'UPDATE users SET google_access_token = ?, google_access_token_expires_at = ? WHERE id = ?'
    ).bind(access_token, expires_at, userId).run();
};

// --- Game Functions ---

export const createGameRevision = async (db, { winner, loser, balls_remaining, fouled_on_black, date, author_id }) => {
    const player1_id = winner < loser ? winner : loser;
    const player2_id = winner < loser ? loser : winner;

    const latestRematch = await db.prepare(
        `SELECT rematch_id FROM game_revisions WHERE player1_id = ? AND player2_id = ? ORDER BY rematch_id DESC LIMIT 1`
    ).bind(player1_id, player2_id).first();
    const rematch_id = latestRematch ? latestRematch.rematch_id + 1 : 0;

    return await db.prepare(
        `INSERT INTO game_revisions (player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(player1_id, player2_id, rematch_id, winner, balls_remaining, fouled_on_black, date, author_id, new Date().toISOString()).run();
};

export const getGameList = async (db) => {
    const { results } = await db.prepare(`
        WITH RankedRevisions AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY player1_id, player2_id, rematch_id ORDER BY revision_id DESC) as rn
            FROM game_revisions
        )
        SELECT * FROM RankedRevisions WHERE rn = 1 ORDER BY played_at DESC, player1_id, player2_id, rematch_id DESC
    `).all();
    return results;
};

export const getAuditLog = async (db) => {
    const { results } = await db.prepare('SELECT * FROM game_revisions ORDER BY authored_at DESC').all();
    return results;
};

export const getGameByCompositeId = async (db, player1Id, player2Id, rematchId) => {
    return await db.prepare(
      `SELECT * FROM game_revisions
       WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
       ORDER BY revision_id DESC
       LIMIT 1`
    ).bind(player1Id, player2Id, rematchId).first();
};

export const updateGame = async (db, { player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id }) => {
    const latestRevision = await db.prepare(
        `SELECT revision_id FROM game_revisions
         WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
         ORDER BY revision_id DESC LIMIT 1`
    ).bind(player1_id, player2_id, rematch_id).first();

    if (!latestRevision) {
        throw new Error('Cannot update a game that does not exist.');
    }

    const newRevisionId = latestRevision.revision_id + 1;
    return await db.prepare(
        `INSERT INTO game_revisions (revision_id, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newRevisionId, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, new Date().toISOString()).run();
};

export const getLeaderboardStats = async (db) => {
    const { results: games } = await db.prepare(`
        WITH RankedRevisions AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY player1_id, player2_id, rematch_id ORDER BY revision_id DESC) as rn
            FROM game_revisions
        )
        SELECT * FROM RankedRevisions WHERE rn = 1
    `).all();

    const { results: players } = await db.prepare('SELECT id FROM users').all();
    const playerMap = new Map(players.map(p => [p.id, { wins: 0, losses: 0, balls_remaining: 0, fouls_on_black: 0 }]));

    for (const game of games) {
        const { player1_id, player2_id, winner_id, balls_remaining, fouled_on_black } = game;
        const winner = winner_id === player1_id ? player1_id : player2_id;
        const loser = winner_id === player1_id ? player2_id : player1_id;

        if (playerMap.has(winner)) playerMap.get(winner).wins++;
        if (playerMap.has(loser)) {
            playerMap.get(loser).losses++;
            playerMap.get(loser).balls_remaining += balls_remaining;
            if (fouled_on_black) playerMap.get(loser).fouls_on_black++;
        }
    }
    return Array.from(playerMap.entries()).map(([playerId, stats]) => ({ playerId, ...stats }));
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
        ).bind(game.player1_id, game.player2_id, game.rematch_id).first();

        const newRevisionId = latestRevision ? latestRevision.revision_id + 1 : 0;
        
        return db.prepare(
            `INSERT INTO game_revisions (revision_id, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            newRevisionId,
            game.player1_id,
            game.player2_id,
            game.rematch_id,
            game.winner_id,
            game.balls_remaining,
            game.fouled_on_black,
            game.played_at,
            game.author_id,
            game.authored_at
        );
    }));

    if (statements.length > 0) {
        await db.batch(statements);
    }
    return statements.length;
};