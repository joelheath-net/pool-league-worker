/**
 * Calculates outstanding games and orders them by priority for which games should be played next.
 *
 * Rules:
 * 1. Only participating players are included. Friendly matches with non-participating players
 *    are excluded from the league schedule and game counts.
 * 2. Whoever has played the least games is highest priority. Players with the most games
 *    should not play until other players have caught up (min max(C[u], C[v])).
 * 3. Initial matchups (round 0) take precedence over rematches (round 1, 2...) when
 *    games played counts are balanced.
 * 4. Lazy evaluation returns at most `limit` games (default 50) efficiently, even for very
 *    large rematch rounds (k).
 *
 * @param {Object} options
 * @param {Array} options.users List of user objects
 * @param {Array} options.games List of game objects from match history
 * @param {number|string} [options.rematchRounds=2] Number of times each pair should play
 * @param {number} [options.limit=50] Maximum number of games to return
 * @returns {Object} { games, totalOutstanding, rematchRounds, participatingCount, limit }
 */
export function calculateOutstandingGames({ users = [], games = [], rematchRounds = 2, limit = 50 } = {}) {
    const k = parseInt(rematchRounds, 10);
    if (isNaN(k) || k < 1) {
        throw new Error('Rematch rounds must be a positive integer of at least 1.');
    }
    if (k > 99) {
        throw new Error('Rematch rounds exceeds maximum allowed limit of 99.');
    }

    const participatingUsers = users.filter(u => Boolean(u.participating));
    const n = participatingUsers.length;

    if (n > 99) {
        throw new Error('Too many participating players to calculate fixtures (maximum 99).');
    }

    if (n < 2) {
        return {
            games: [],
            totalOutstanding: 0,
            rematchRounds: k,
            participatingCount: n,
            limit
        };
    }

    const userMap = new Map(participatingUsers.map(u => [u.id, u]));

    // Track total games played by each participating player against participating players
    const gamesPlayed = new Map(participatingUsers.map(u => [u.id, 0]));

    // Track played rematches per canonical pair "p1Id:p2Id" where p1Id < p2Id
    const playedRematches = new Map();

    for (const game of games) {
        const p1Id = game.player1Id;
        const p2Id = game.player2Id;

        // Friendly matches involving non-participating players do not count
        if (!userMap.has(p1Id) || !userMap.has(p2Id)) {
            continue;
        }

        gamesPlayed.set(p1Id, gamesPlayed.get(p1Id) + 1);
        gamesPlayed.set(p2Id, gamesPlayed.get(p2Id) + 1);

        const canonicalP1 = p1Id < p2Id ? p1Id : p2Id;
        const canonicalP2 = p1Id < p2Id ? p2Id : p1Id;
        const pairKey = `${canonicalP1}:${canonicalP2}`;

        if (!playedRematches.has(pairKey)) {
            playedRematches.set(pairKey, new Set());
        }
        if (typeof game.rematchId === 'number') {
            playedRematches.get(pairKey).add(game.rematchId);
        }
    }

    // Generate all pairs and determine outstanding matches
    let totalOutstanding = 0;
    const activePairs = [];

    // Sort participating users deterministically
    const sortedUsers = [...participatingUsers].sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 0; i < sortedUsers.length; i++) {
        for (let j = i + 1; j < sortedUsers.length; j++) {
            const p1 = sortedUsers[i].id;
            const p2 = sortedUsers[j].id;
            const pairKey = `${p1}:${p2}`;
            const playedSet = playedRematches.get(pairKey) || new Set();

            // Count how many rematches with r < k have already been played
            let playedUnderK = 0;
            for (const r of playedSet) {
                if (r < k) {
                    playedUnderK++;
                }
            }

            const outstandingCount = Math.max(0, k - playedUnderK);
            totalOutstanding += outstandingCount;

            if (outstandingCount > 0) {
                // Find smallest unplayed rematch index < k
                let nextR = 0;
                while (playedSet.has(nextR) && nextR < k) {
                    nextR++;
                }

                if (nextR < k) {
                    const u1 = userMap.get(p1);
                    const u2 = userMap.get(p2);
                    const tieKey = `${u1.name}:${u2.name}`;
                    activePairs.push({
                        p1,
                        p2,
                        nextRematch: nextR,
                        playedSet,
                        tieKey
                    });
                }
            }
        }
    }

    // Lazy simulation loop to schedule up to `limit` games
    const scheduledGames = [];
    const maxToSchedule = Math.min(limit, totalOutstanding);

    while (scheduledGames.length < maxToSchedule && activePairs.length > 0) {
        let bestIndex = -1;
        let bestKey = null;

        for (let i = 0; i < activePairs.length; i++) {
            const pair = activePairs[i];
            const p1Count = gamesPlayed.get(pair.p1);
            const p2Count = gamesPlayed.get(pair.p2);

            const maxGames = Math.max(p1Count, p2Count);
            const sumGames = p1Count + p2Count;
            const r = pair.nextRematch;

            // Comparison criteria:
            // 1. Min maxGames (least games played takes priority; don't let most active play further)
            // 2. Min sumGames (both players having fewer games)
            // 3. Min r (earlier rounds / first matches take priority over rematches)
            // 4. tieKey (deterministic ordering)
            const currentKey = { maxGames, sumGames, r, tieKey: pair.tieKey };

            if (bestIndex === -1 || compareKeys(currentKey, bestKey) < 0) {
                bestIndex = i;
                bestKey = currentKey;
            }
        }

        const bestPair = activePairs[bestIndex];
        const p1User = userMap.get(bestPair.p1);
        const p2User = userMap.get(bestPair.p2);
        const p1Count = gamesPlayed.get(bestPair.p1);
        const p2Count = gamesPlayed.get(bestPair.p2);

        scheduledGames.push({
            order: scheduledGames.length + 1,
            player1: {
                id: p1User.id,
                name: p1User.name,
                team: p1User.team,
                teamColor: p1User.teamColor
            },
            player2: {
                id: p2User.id,
                name: p2User.name,
                team: p2User.team,
                teamColor: p2User.teamColor
            },
            rematchId: bestPair.nextRematch,
            roundName: bestPair.nextRematch === 0 ? 'First Match' : `Rematch ${bestPair.nextRematch}`,
            player1Games: p1Count,
            player2Games: p2Count
        });

        // Simulate game played
        gamesPlayed.set(bestPair.p1, p1Count + 1);
        gamesPlayed.set(bestPair.p2, p2Count + 1);

        // Advance to next unplayed rematch for this pair
        let nextR = bestPair.nextRematch + 1;
        while (bestPair.playedSet.has(nextR) && nextR < k) {
            nextR++;
        }

        if (nextR < k) {
            bestPair.nextRematch = nextR;
        } else {
            // All rematches for this pair have been scheduled
            activePairs.splice(bestIndex, 1);
        }
    }

    return {
        games: scheduledGames,
        totalOutstanding,
        rematchRounds: k,
        participatingCount: n,
        limit
    };
}

function compareKeys(a, b) {
    if (a.maxGames !== b.maxGames) return a.maxGames - b.maxGames;
    if (a.sumGames !== b.sumGames) return a.sumGames - b.sumGames;
    if (a.r !== b.r) return a.r - b.r;
    return a.tieKey.localeCompare(b.tieKey);
}
