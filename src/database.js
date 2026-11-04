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
    const user = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').bind(id).first();
    return keysToCamel(user);
};

export const getUserAccessFlags = async (db, userId) => {
    if (!db || !userId) return { isAdmin: false, isParticipating: false, exists: false };
    const row = await db.prepare('SELECT role, participating FROM users WHERE id = ?').bind(userId).first();
    if (!row) return { isAdmin: false, isParticipating: false, exists: false };
    return {
        isAdmin: row.role === 'admin',
        isParticipating: Boolean(row.participating),
        exists: true,
    };
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
    const user = await db.prepare('SELECT id, email, google_refresh_token FROM users WHERE id = ?').bind(userId).first();
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

const formatGameRow = (row) => {
    if (!row) return null;
    const camel = keysToCamel(row);
    return {
        gameId: camel.gameId,
        homePlayerId: camel.homePlayerId,
        awayPlayerId: camel.awayPlayerId,
        winnerHome: camel.winnerId === camel.homePlayerId,
        rematchId: camel.rematchId,
        revisionId: camel.revisionId,
        authorId: camel.authorId,
        authoredAt: camel.authoredAt,
        ballsRemaining: camel.ballsRemaining,
        fouledOnBlack: Boolean(camel.fouledOnBlack),
        playedAt: camel.playedAt,
    };
};

export const createGame = async (db, { homePlayerId, awayPlayerId, winnerHome, ballsRemaining, fouledOnBlack, playedAt, authorId }) => {
    const winnerId = winnerHome ? homePlayerId : awayPlayerId;
    const authoredAt = new Date().toISOString();

    const [gameInsertResult] = await db.batch([
        db.prepare(`
            INSERT INTO games (home_player_id, away_player_id, rematch_id)
            SELECT ?, ?, COALESCE(MAX(rematch_id) + 1, 0)
            FROM games
            WHERE (home_player_id = ? AND away_player_id = ?)
               OR (home_player_id = ? AND away_player_id = ?)
        `).bind(
            homePlayerId,
            awayPlayerId,
            homePlayerId,
            awayPlayerId,
            awayPlayerId,
            homePlayerId
        ),
        db.prepare(`
            INSERT INTO game_revisions (
                game_id, revision_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at
            )
            VALUES (last_insert_rowid(), 0, ?, ?, ?, ?, ?, ?)
        `).bind(
            winnerId,
            ballsRemaining,
            fouledOnBlack ? 1 : 0,
            playedAt,
            authorId,
            authoredAt
        )
    ]);

    return { gameId: gameInsertResult?.meta?.last_row_id };
};

export const getGameList = async (db) => {
    const { results } = await db.prepare(`
        WITH RankedRevisions AS (
            SELECT
                g.id AS game_id,
                g.home_player_id,
                g.away_player_id,
                g.rematch_id,
                gr.revision_id,
                gr.winner_id,
                gr.author_id,
                gr.authored_at,
                gr.balls_remaining,
                gr.fouled_on_black,
                gr.played_at,
                ROW_NUMBER() OVER (PARTITION BY gr.game_id ORDER BY gr.revision_id DESC) AS rn
            FROM games g
            JOIN game_revisions gr ON gr.game_id = g.id
        )
        SELECT * FROM RankedRevisions
        WHERE rn = 1
        ORDER BY played_at DESC, game_id DESC
    `).all();
    return (results || []).map(formatGameRow);
};

export const getAuditLog = async (db) => {
    const { results } = await db.prepare(`
        SELECT
            g.id AS game_id,
            g.home_player_id,
            g.away_player_id,
            g.rematch_id,
            gr.revision_id,
            gr.winner_id,
            gr.author_id,
            gr.authored_at,
            gr.balls_remaining,
            gr.fouled_on_black,
            gr.played_at
        FROM game_revisions gr
        JOIN games g ON g.id = gr.game_id
        ORDER BY gr.authored_at DESC, gr.game_id DESC, gr.revision_id DESC
    `).all();
    return (results || []).map(formatGameRow);
};

export const getGameById = async (db, gameId) => {
    const row = await db.prepare(`
        SELECT
            g.id AS game_id,
            g.home_player_id,
            g.away_player_id,
            g.rematch_id,
            gr.revision_id,
            gr.winner_id,
            gr.author_id,
            gr.authored_at,
            gr.balls_remaining,
            gr.fouled_on_black,
            gr.played_at
        FROM games g
        JOIN game_revisions gr ON gr.game_id = g.id
        WHERE g.id = ?
        ORDER BY gr.revision_id DESC
        LIMIT 1
    `).bind(gameId).first();
    return formatGameRow(row);
};

export const updateGame = async (db, gameId, { winnerHome, ballsRemaining, fouledOnBlack, playedAt, authorId }) => {
    const existingGame = await getGameById(db, gameId);
    if (!existingGame) {
        throw new Error('Cannot update a game that does not exist.');
    }

    const winnerId = winnerHome ? existingGame.homePlayerId : existingGame.awayPlayerId;
    const authoredAt = new Date().toISOString();

    return await db.prepare(`
        INSERT INTO game_revisions (
            game_id, revision_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at
        )
        SELECT
            ?,
            COALESCE(MAX(revision_id) + 1, 0),
            ?, ?, ?, ?, ?, ?
        FROM game_revisions
        WHERE game_id = ?
    `).bind(
        gameId,
        winnerId,
        ballsRemaining,
        fouledOnBlack ? 1 : 0,
        playedAt,
        authorId,
        authoredAt,
        gameId
    ).run();
};

export const getLeaderboardStats = async (db) => {
    const games = await getGameList(db);

    const { results } = await db.prepare('SELECT id FROM users WHERE participating = 1').all();
    const players = new Map(results.map(p => [p.id, { wins: 0, losses: 0, ballsRemaining: 0, foulsOnBlack: 0 }]));

    for (const game of games) {
        const { homePlayerId, awayPlayerId, winnerHome, ballsRemaining, fouledOnBlack } = game;

        // Games involving any non-participating player are not included in leaderboard tallies
        if (!players.has(homePlayerId) || !players.has(awayPlayerId)) {
            continue;
        }

        const winner = winnerHome ? homePlayerId : awayPlayerId;
        const loser = winnerHome ? awayPlayerId : homePlayerId;

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
    const [, gamesDeleteResult] = await db.batch([
        db.prepare('DELETE FROM game_revisions'),
        db.prepare('DELETE FROM games')
    ]);
    return gamesDeleteResult;
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

export const getAllTimeLeaderboardStats = async (db) => {
    // 1. Get all users (both participating and non-participating)
    const { results: userResults } = await db.prepare(
        'SELECT id, name, team, team_color, participating FROM users'
    ).all();
    const users = keysToCamel(userResults);

    const players = new Map();
    for (const user of users) {
        players.set(user.id, {
            playerId: user.id,
            name: user.name,
            team: user.team,
            teamColor: user.teamColor || '#ffffff',
            participating: Boolean(user.participating),
            wins: 0,
            losses: 0,
            foulsOnBlack: 0,
            ballsRemaining: 0,
            points: 0,
        });
    }

    // 2. Aggregate stats from all archived seasons
    const { results: archiveResults } = await db.prepare(`
        SELECT
            player_id,
            name,
            team,
            team_color,
            wins,
            losses,
            fouls_on_black,
            balls_remaining,
            points
        FROM archived_tables
        ORDER BY season_id ASC
    `).all();
    const archivedRows = keysToCamel(archiveResults);

    for (const row of archivedRows) {
        if (!players.has(row.playerId)) {
            players.set(row.playerId, {
                playerId: row.playerId,
                name: row.name,
                team: row.team,
                teamColor: row.teamColor || '#ffffff',
                participating: false,
                wins: 0,
                losses: 0,
                foulsOnBlack: 0,
                ballsRemaining: 0,
                points: 0,
            });
        }
        const player = players.get(row.playerId);
        player.wins += row.wins;
        player.losses += row.losses;
        player.foulsOnBlack += row.foulsOnBlack;
        player.ballsRemaining += row.ballsRemaining;

        // If player is not currently in users table, preserve archived identity
        if (!users.some(u => u.id === row.playerId)) {
            player.name = row.name;
            player.team = row.team;
            player.teamColor = row.teamColor || '#ffffff';
        }
    }

    // 3. Tally all current season games (all players, not just participating)
    const games = await getGameList(db);
    for (const game of games) {
        const { homePlayerId, awayPlayerId, winnerHome, ballsRemaining, fouledOnBlack } = game;
        const winner = winnerHome ? homePlayerId : awayPlayerId;
        const loser = winnerHome ? awayPlayerId : homePlayerId;

        if (!players.has(winner)) {
            players.set(winner, {
                playerId: winner,
                name: 'Unknown Player',
                team: 'My Team',
                teamColor: '#ffffff',
                participating: false,
                wins: 0,
                losses: 0,
                foulsOnBlack: 0,
                ballsRemaining: 0,
                points: 0,
            });
        }
        if (!players.has(loser)) {
            players.set(loser, {
                playerId: loser,
                name: 'Unknown Player',
                team: 'My Team',
                teamColor: '#ffffff',
                participating: false,
                wins: 0,
                losses: 0,
                foulsOnBlack: 0,
                ballsRemaining: 0,
                points: 0,
            });
        }

        players.get(winner).wins++;
        players.get(loser).losses++;
        players.get(loser).ballsRemaining += ballsRemaining;
        if (fouledOnBlack) {
            players.get(loser).foulsOnBlack++;
        }
    }

    // 4. Calculate points, played, and win/loss ratio for each player
    const leaderboard = Array.from(players.values()).map(player => {
        const points = player.wins * 3 + player.losses - player.foulsOnBlack;
        const played = player.wins + player.losses;
        const winLossRatio = player.losses > 0
            ? (player.wins / player.losses).toFixed(2)
            : (player.wins > 0 ? "∞" : "0.00");
        const ratioNumeric = player.losses > 0
            ? (player.wins / player.losses)
            : (player.wins > 0 ? Infinity : 0);

        return {
            ...player,
            points,
            played,
            winLossRatio,
            ratioNumeric,
        };
    });

    // 5. Default sort: points descending, ballsRemaining ascending, foulsOnBlack ascending
    leaderboard.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.ballsRemaining !== b.ballsRemaining) return a.ballsRemaining - b.ballsRemaining;
        return a.foulsOnBlack - b.foulsOnBlack;
    });

    return leaderboard;
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

    // 5. Prepare statements to clear current games and revisions
    const clearRevisionsStatement = db.prepare('DELETE FROM game_revisions');
    const clearGamesStatement = db.prepare('DELETE FROM games');

    // 6. Batch all operations together in a transaction
    await db.batch([
        ...insertStatements,
        clearRevisionsStatement,
        clearGamesStatement
    ]);

    return { newSeasonId: seasonId };
};

// --- Push Notification Subscription Functions ---

export const savePushSubscription = async (db, userId, { endpoint, p256dh, auth }) => {
    return await db.prepare(`
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth
    `).bind(userId, endpoint, p256dh, auth).run();
};

export const deletePushSubscription = async (db, endpoint) => {
    return await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
};

export const deletePushSubscriptionsForUser = async (db, userId) => {
    return await db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId).run();
};

export const getPushSubscriptionsForUser = async (db, userId) => {
    const { results } = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(userId).all();
    return results || [];
};

export const hasPushSubscription = async (db, userId) => {
    const row = await db.prepare('SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1').bind(userId).first();
    return Boolean(row);
};
