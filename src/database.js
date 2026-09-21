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

export const getUsers = async (db, { participatingOnly = false } = {}) => {
    let query = 'SELECT id, name, team, team_color, participating FROM users';
    if (participatingOnly) {
        query += ' WHERE participating = 1';
    }
    query += ' ORDER BY name COLLATE NOCASE ASC';
    const { results } = await db.prepare(query).all();
    return keysToCamel(results).map(u => ({ ...u, participating: Boolean(u.participating) }));
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
    const user = await db.prepare('SELECT id, name, team, team_color, participating FROM users WHERE id = ?').bind(id).first();
    const camel = keysToCamel(user);
    if (camel) camel.participating = Boolean(camel.participating);
    return camel;
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
            role: 'user',
        };
        await db.prepare(`
            INSERT INTO users (id, name, email, role, google_access_token, google_access_token_expires_at, google_refresh_token, participating)
            VALUES (?, ?, ?, 'user', ?, ?, ?, 1)`
        ).bind(
            user.id,
            user.name,
            user.email,
            tokens.access_token,
            expiresAt,
            tokens.refresh_token || null
        ).run();
        user.hasRefreshToken = Boolean(tokens.refresh_token);
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

        const tokenRecord = await getUserForRefresh(db, user.id);
        user.hasRefreshToken = Boolean(tokens.refresh_token || tokenRecord?.googleRefreshToken);
    }

    return user;
};

// VERY SENSITIVE, DO NOT EXPOSE REFRESH TOKEN
export const getUserForRefresh = async (db, userId) => {
    const user = await db.prepare('SELECT id, email, role, google_refresh_token FROM users WHERE id = ?').bind(userId).first();
    return keysToCamel(user);
};

export const clearUserRefreshToken = async (db, userId) => {
    return await db.prepare('UPDATE users SET google_refresh_token = NULL WHERE id = ?').bind(userId).run();
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
        'SELECT rematch_id FROM game_revisions WHERE player1_id = ? AND player2_id = ? ORDER BY rematch_id DESC LIMIT 1'
    ).bind(player1Id, player2Id).first();
    const rematchId = latestRematch ? keysToCamel(latestRematch).rematchId + 1 : 0;

    return await db.prepare(`
        INSERT INTO game_revisions (player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
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
    const game = await db.prepare(`
        SELECT * FROM game_revisions
        WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
        ORDER BY revision_id DESC
        LIMIT 1`
    ).bind(player1Id, player2Id, rematchId).first();
    return keysToCamel(game);
};

export const updateGame = async (db, { player1Id, player2Id, rematchId, winnerId, ballsRemaining, fouledOnBlack, playedAt, authorId }) => {
    const latestRevisionResult = await db.prepare(`
        SELECT revision_id FROM game_revisions
        WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
        ORDER BY revision_id DESC LIMIT 1`
    ).bind(player1Id, player2Id, rematchId).first();

    if (!latestRevisionResult) {
        throw new Error('Cannot update a game that does not exist.');
    }
    const latestRevision = keysToCamel(latestRevisionResult);

    const newRevisionId = latestRevision.revisionId + 1;
    return await db.prepare(`
        INSERT INTO game_revisions (revision_id, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(newRevisionId, player1Id, player2Id, rematchId, winnerId, ballsRemaining, fouledOnBlack, playedAt, authorId, new Date().toISOString()).run();
};

export const getLeaderboardStats = async (db) => {
    const games = await getGameList(db);

    const { results } = await db.prepare('SELECT id FROM users WHERE participating = 1').all();
    const players = new Map(results.map(p => [p.id, { wins: 0, losses: 0, ballsRemaining: 0, foulsOnBlack: 0 }]));

    for (const game of games) {
        const { player1Id, player2Id, winnerId, ballsRemaining, fouledOnBlack } = game;

        // Games involving any non-participating player are not included in leaderboard tallies
        if (!players.has(player1Id) || !players.has(player2Id)) {
            continue;
        }

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

export const updateUsersParticipation = async (db, participations) => {
    const statements = participations.map(p =>
        db.prepare('UPDATE users SET participating = ? WHERE id = ?').bind(p.participating ? 1 : 0, p.id)
    );
    if (statements.length > 0) {
        await db.batch(statements);
    }
    return statements.length;
};

export const updatePlayers = async (db, players) => {
    const statements = players.map(p =>
        db.prepare(
            'UPDATE users SET name = ?, team = ?, team_color = ?, participating = ? WHERE id = ?'
        ).bind(p.name, p.team, p.teamColor, p.participating ? 1 : 0, p.id)
    );
    if (statements.length > 0) {
        await db.batch(statements);
    }
    return statements.length;
};

export const resetGames = async (db) => {
    return await db.prepare('DELETE FROM game_revisions').run();
};

// --- Whitelist Functions ---

export const isEmailWhitelisted = async (db, email) => {
    if (!email) return false;
    const row = await db.prepare('SELECT email FROM whitelisted_emails WHERE LOWER(email) = LOWER(?)').bind(email.trim()).first();
    return !!row;
};

export const getWhitelistedEmails = async (db) => {
    const { results } = await db.prepare('SELECT email, created_at FROM whitelisted_emails ORDER BY email COLLATE NOCASE ASC').all();
    return keysToCamel(results);
};

export const addWhitelistedEmail = async (db, email) => {
    const cleanEmail = email.trim().toLowerCase();
    return await db.prepare('INSERT OR IGNORE INTO whitelisted_emails (email) VALUES (?)').bind(cleanEmail).run();
};

export const removeWhitelistedEmail = async (db, email) => {
    const cleanEmail = email.trim().toLowerCase();
    return await db.prepare('DELETE FROM whitelisted_emails WHERE LOWER(email) = LOWER(?)').bind(cleanEmail).run();
};


// --- Archive Functions ---

export const getArchivedLeaderboard = async (db, seasonId) => {
    const { results } = await db.prepare(`
        SELECT
            a.player_id,
            a.name,
            a.team,
            a.team_color,
            a.wins,
            a.losses,
            a.balls_remaining,
            a.fouls_on_black,
            a.points
        FROM archived_tables a
        WHERE a.season_id = ?`
    ).bind(seasonId).all();
    return keysToCamel(results);
};

export const getArchivedSeasonInfo = async (db, seasonId) => {
    return await db.prepare('SELECT id, name FROM archived_seasons WHERE id = ?').bind(seasonId).first();
};

export const getArchivedSeasons = async (db) => {
    const { results } = await db.prepare('SELECT id, name FROM archived_seasons ORDER BY id DESC').all();
    return keysToCamel(results);
};

export const archiveSeason = async (db, seasonName) => {
    // 1. Get the current leaderboard stats
    const leaderboardStats = await getLeaderboardStats(db);
    if (leaderboardStats.length === 0) {
        throw new Error("Cannot archive an empty season.");
    }

    const playerIds = leaderboardStats.map(({ playerId }) => playerId);
    const usersById = new Map();

    if (playerIds.length > 0) {
        const placeholders = playerIds.map(() => '?').join(', ');
        const { results } = await db.prepare(`
            SELECT id, name, team, team_color
            FROM users
            WHERE id IN (${placeholders})`
        ).bind(...playerIds).all();

        for (const user of keysToCamel(results)) {
            usersById.set(user.id, user);
        }
    }

    // 2. Process stats to calculate points and freeze the player identity snapshot
    const processedStats = leaderboardStats.map(playerStats => {
        const points = playerStats.wins * 3 + playerStats.losses - playerStats.foulsOnBlack;
        const user = usersById.get(playerStats.playerId) || {
            name: 'Unknown Player',
            team: 'My Team',
            teamColor: '#ffffff'
        };

        return {
            ...playerStats,
            name: user.name,
            team: user.team,
            teamColor: user.teamColor,
            points
        };
    });

    // 3. Create a new season entry and get its ID
    const seasonId = (await db.prepare(
            'INSERT INTO archived_seasons (name) VALUES (?)'
        ).bind(seasonName).run())
        .meta.last_row_id;

    // 4. Prepare statements to insert leaderboard data
    const insertStatements = processedStats.map(stats => {
        return db.prepare(`
            INSERT INTO archived_tables (season_id, player_id, name, team, team_color, points, wins, losses, fouls_on_black, balls_remaining)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            seasonId,
            stats.playerId,
            stats.name,
            stats.team,
            stats.teamColor,
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