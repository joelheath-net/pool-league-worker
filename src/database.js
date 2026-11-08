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
        isDeleted: Boolean(camel.isDeleted),
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
            WHERE is_deleted = 0
              AND (
                  (home_player_id = ? AND away_player_id = ?)
                  OR (home_player_id = ? AND away_player_id = ?)
              )
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
                game_id, revision_id, is_deleted, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at
            )
            VALUES (last_insert_rowid(), 0, 0, ?, ?, ?, ?, ?, ?)
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
                gr.is_deleted,
                gr.winner_id,
                gr.author_id,
                gr.authored_at,
                gr.balls_remaining,
                gr.fouled_on_black,
                gr.played_at,
                ROW_NUMBER() OVER (PARTITION BY gr.game_id ORDER BY gr.revision_id DESC) AS rn
            FROM games g
            JOIN game_revisions gr ON gr.game_id = g.id
            WHERE g.is_deleted = 0
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
            gr.is_deleted,
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
            gr.is_deleted,
            gr.winner_id,
            gr.author_id,
            gr.authored_at,
            gr.balls_remaining,
            gr.fouled_on_black,
            gr.played_at
        FROM games g
        JOIN game_revisions gr ON gr.game_id = g.id
        WHERE g.id = ?
          AND g.is_deleted = 0
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
            game_id, revision_id, is_deleted, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at
        )
        SELECT
            ?,
            COALESCE(MAX(gr.revision_id) + 1, 0),
            0,
            ?, ?, ?, ?, ?, ?
        FROM game_revisions gr
        JOIN games g ON g.id = gr.game_id
        WHERE gr.game_id = ?
          AND g.is_deleted = 0
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

export const deleteGame = async (db, gameId, { authorId }) => {
    const authoredAt = new Date().toISOString();
    const REMATCH_SHIFT_OFFSET = 1000000;

    const [, , markDeletedResult] = await db.batch([
        // 1. Snapshot the latest recorded stats into a deletion revision (only if game exists & is not already deleted)
        db.prepare(`
            INSERT INTO game_revisions (
                game_id, revision_id, is_deleted, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at
            )
            SELECT
                g.id,
                gr.revision_id + 1,
                1,
                gr.winner_id,
                gr.balls_remaining,
                gr.fouled_on_black,
                gr.played_at,
                ?,
                ?
            FROM games g
            JOIN game_revisions gr ON gr.game_id = g.id
            WHERE g.id = ?
              AND g.is_deleted = 0
            ORDER BY gr.revision_id DESC
            LIMIT 1
        `).bind(authorId, authoredAt, gameId),

        // 2. Temporarily offset all later active rematches for this pair to avoid transient unique-index collisions
        db.prepare(`
            UPDATE games
            SET rematch_id = rematch_id + ${REMATCH_SHIFT_OFFSET}
            WHERE is_deleted = 0
              AND EXISTS (
                  SELECT 1 FROM games target
                  WHERE target.id = ?
                    AND target.is_deleted = 0
                    AND games.rematch_id > target.rematch_id
                    AND (
                        (games.home_player_id = target.home_player_id AND games.away_player_id = target.away_player_id)
                        OR (games.home_player_id = target.away_player_id AND games.away_player_id = target.home_player_id)
                    )
              )
        `).bind(gameId),

        // 3. Soft-delete the game so it leaves active indices, game lists, and leaderboards
        db.prepare(`
            UPDATE games
            SET is_deleted = 1
            WHERE id = ?
              AND is_deleted = 0
        `).bind(gameId),

        // 4. Finalize the -1 shift on all later active rematches for this pair
        db.prepare(`
            UPDATE games
            SET rematch_id = rematch_id - ${REMATCH_SHIFT_OFFSET + 1}
            WHERE is_deleted = 0
              AND rematch_id >= ${REMATCH_SHIFT_OFFSET}
        `)
    ]);

    return { deleted: (markDeletedResult?.meta?.changes ?? 0) > 0 };
};

// --- Leaderboard Ranking Single Source of Truth ---

/**
 * Resolves a group of players who are tied on overall (points, ballsRemaining)
 * into an ordered list of buckets using Premier League-style Head-to-Head points
 * (points gained only in matches played between the tied players).
 * Players remaining in the same bucket are completely tied and share the same position.
 */
const resolveHeadToHeadBuckets = (tiedGroup, games = []) => {
    if (tiedGroup.length <= 1) {
        return [tiedGroup];
    }

    const groupIds = new Set(tiedGroup.map((p) => p.playerId));
    const h2hPointsMap = new Map(tiedGroup.map((p) => [p.playerId, 0]));

    for (const game of games) {
        const { homePlayerId, awayPlayerId, winnerHome, fouledOnBlack } = game;
        if (!groupIds.has(homePlayerId) || !groupIds.has(awayPlayerId)) {
            continue;
        }

        const winnerId = winnerHome ? homePlayerId : awayPlayerId;
        const loserId = winnerHome ? awayPlayerId : homePlayerId;

        h2hPointsMap.set(winnerId, h2hPointsMap.get(winnerId) + 3);
        if (!fouledOnBlack) {
            h2hPointsMap.set(loserId, h2hPointsMap.get(loserId) + 1);
        }
    }

    const byH2H = new Map();
    for (const player of tiedGroup) {
        const pts = h2hPointsMap.get(player.playerId) || 0;
        if (!byH2H.has(pts)) {
            byH2H.set(pts, []);
        }
        byH2H.get(pts).push(player);
    }

    const sortedH2HValues = Array.from(byH2H.keys()).sort((a, b) => b - a);

    // If all players in this tied group gained the exact same H2H points, they share the same rank
    if (sortedH2HValues.length === 1) {
        const bucket = [...byH2H.get(sortedH2HValues[0])];
        bucket.sort((a, b) =>
            (a.name || '').localeCompare(b.name || '') ||
            (a.team || '').localeCompare(b.team || '') ||
            String(a.playerId).localeCompare(String(b.playerId))
        );
        return [bucket];
    }

    // H2H points separated the group; recursively resolve any subgroup that still has 2+ tied players
    const resolvedBuckets = [];
    for (const h2hVal of sortedH2HValues) {
        const subGroup = byH2H.get(h2hVal);
        if (subGroup.length > 1) {
            resolvedBuckets.push(...resolveHeadToHeadBuckets(subGroup, games));
        } else {
            resolvedBuckets.push(subGroup);
        }
    }

    return resolvedBuckets;
};

/**
 * Single source of truth for computing derived stats, sorting players, and assigning
 * dense league positions (1, 2, 2, 3...) according to official league rules:
 * 1. Points descending (wins * 3 + losses - foulsOnBlack)
 * 2. Ball difference (ballsRemaining) ascending
 * 3. Head-to-head points descending (points gained in matches between tied players)
 * 4. Shared position if still tied
 */
export const rankLeaderboardPlayers = (playersList, games = []) => {
    if (!Array.isArray(playersList) || playersList.length === 0) {
        return [];
    }

    const enriched = playersList.map((player) => {
        const wins = Number(player.wins) || 0;
        const losses = Number(player.losses) || 0;
        const ballsRemaining = Number(player.ballsRemaining) || 0;
        const foulsOnBlack = Number(player.foulsOnBlack) || 0;
        const points = player.points !== undefined
            ? Number(player.points)
            : wins * 3 + losses - foulsOnBlack;
        const played = wins + losses;
        const winLossRatio = losses > 0
            ? (wins / losses).toFixed(2)
            : (wins > 0 ? '∞' : '0.00');
        const ratioNumeric = losses > 0
            ? (wins / losses)
            : (wins > 0 ? Infinity : 0);

        return {
            ...player,
            wins,
            losses,
            ballsRemaining,
            foulsOnBlack,
            points,
            played,
            winLossRatio,
            ratioNumeric
        };
    });

    // Primary sort: Points DESC, then Ball Difference (ballsRemaining) ASC
    enriched.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.ballsRemaining - b.ballsRemaining;
    });

    // Partition into groups tied on both points and ballsRemaining
    const primaryGroups = [];
    for (const player of enriched) {
        const lastGroup = primaryGroups[primaryGroups.length - 1];
        if (
            lastGroup &&
            lastGroup[0].points === player.points &&
            lastGroup[0].ballsRemaining === player.ballsRemaining
        ) {
            lastGroup.push(player);
        } else {
            primaryGroups.push([player]);
        }
    }

    // Resolve each primary group into final rank buckets via Head-to-Head points
    const finalBuckets = [];
    for (const group of primaryGroups) {
        if (group.length === 1) {
            finalBuckets.push(group);
        } else {
            finalBuckets.push(...resolveHeadToHeadBuckets(group, games));
        }
    }

    // Assign dense position (1, 2, 2, 3...) per bucket
    const rankedLeaderboard = [];
    finalBuckets.forEach((bucket, index) => {
        const position = index + 1;
        for (const player of bucket) {
            rankedLeaderboard.push({
                ...player,
                position
            });
        }
    });

    return rankedLeaderboard;
};

export const getLeaderboardStats = async (db) => {
    const [games, { results }] = await Promise.all([
        getGameList(db),
        db.prepare('SELECT id, name, team, team_color, participating FROM users WHERE participating = 1').all()
    ]);

    const users = keysToCamel(results || []);
    const players = new Map(
        users.map((u) => [
            u.id,
            {
                playerId: u.id,
                name: u.name,
                team: u.team,
                teamColor: u.teamColor || '#ffffff',
                participating: Boolean(u.participating),
                wins: 0,
                losses: 0,
                ballsRemaining: 0,
                foulsOnBlack: 0
            }
        ])
    );

    const participatingGames = [];

    for (const game of games) {
        const { homePlayerId, awayPlayerId, winnerHome, ballsRemaining, fouledOnBlack } = game;

        // Games involving any non-participating player are not included in leaderboard tallies
        if (!players.has(homePlayerId) || !players.has(awayPlayerId)) {
            continue;
        }

        participatingGames.push(game);

        const winner = winnerHome ? homePlayerId : awayPlayerId;
        const loser = winnerHome ? awayPlayerId : homePlayerId;

        players.get(winner).wins++;
        players.get(loser).losses++;
        players.get(loser).ballsRemaining += ballsRemaining;
        if (fouledOnBlack) players.get(loser).foulsOnBlack++;
    }

    return rankLeaderboardPlayers(Array.from(players.values()), participatingGames);
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
    return rankLeaderboardPlayers(keysToCamel(results), []);
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
            });
        }

        players.get(winner).wins++;
        players.get(loser).losses++;
        players.get(loser).ballsRemaining += ballsRemaining;
        if (fouledOnBlack) {
            players.get(loser).foulsOnBlack++;
        }
    }

    // 4. Rank and enrich using the single-source-of-truth ranking logic
    return rankLeaderboardPlayers(Array.from(players.values()), games);
};


export const archiveSeason = async (db, seasonName) => {
    // 1. Get the current ranked leaderboard stats (already includes name, team, teamColor, points, position)
    const leaderboardStats = await getLeaderboardStats(db);
    if (leaderboardStats.length === 0) {
        throw new Error("Cannot archive an empty season.");
    }

    // 2. Create a new season entry and get its ID
    const seasonId = (await db.prepare(
            'INSERT INTO archived_seasons (name) VALUES (?)'
        ).bind(seasonName).run())
        .meta.last_row_id;

    // 3. Prepare statements to insert leaderboard data
    const insertStatements = leaderboardStats.map(stats => {
        return db.prepare(`
            INSERT INTO archived_tables (season_id, player_id, name, team, team_color, points, wins, losses, fouls_on_black, balls_remaining)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            seasonId,
            stats.playerId,
            stats.name || 'Unknown Player',
            stats.team || 'My Team',
            stats.teamColor || '#ffffff',
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
