import { buildPushPayload } from '@block65/webcrypto-web-push';
import {
    getLeaderboardStats,
    getPushSubscriptionsForUser,
    deletePushSubscription
} from './database.js';

/**
 * Calculates the current ranking position (1-indexed) for each participating player.
 * Uses identical ranking criteria as the official leaderboard:
 * 1. Points descending (wins * 3 + losses - foulsOnBlack)
 * 2. Balls remaining ascending (tie-breaker)
 * 3. Fouls on black ascending (tie-breaker)
 *
 * @param {D1Database} db
 * @returns {Promise<Record<string, number>>} Map of playerId -> rank (1, 2, 3...)
 */
export const getLeaderboardRanks = async (db) => {
    const stats = await getLeaderboardStats(db);
    if (!stats || stats.length === 0) return {};

    const players = stats.map((player) => {
        const points = player.wins * 3 + player.losses - player.foulsOnBlack;
        return {
            playerId: player.playerId,
            points,
            ballsRemaining: player.ballsRemaining,
            foulsOnBlack: player.foulsOnBlack
        };
    });

    players.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.ballsRemaining !== b.ballsRemaining) return a.ballsRemaining - b.ballsRemaining;
        return a.foulsOnBlack - b.foulsOnBlack;
    });

    const ranks = {};
    players.forEach((p, index) => {
        ranks[p.playerId] = index + 1;
    });

    return ranks;
};

/**
 * Diffs previous rankings against new rankings to find all players whose rank shifted.
 *
 * @param {Record<string, number>} oldRanks
 * @param {Record<string, number>} newRanks
 * @returns {Array<{ playerId: string, oldRank: number|null, newRank: number, improved: boolean }>}
 */
export const diffRankings = (oldRanks, newRanks) => {
    const changes = [];
    const allPlayerIds = new Set([...Object.keys(oldRanks || {}), ...Object.keys(newRanks || {})]);

    for (const playerId of allPlayerIds) {
        const oldRank = oldRanks ? oldRanks[playerId] : undefined;
        const newRank = newRanks ? newRanks[playerId] : undefined;

        if (newRank !== undefined) {
            if (oldRank !== undefined && oldRank !== newRank) {
                changes.push({
                    playerId,
                    oldRank,
                    newRank,
                    improved: newRank < oldRank
                });
            } else if (oldRank === undefined) {
                // New entrant on the leaderboard
                changes.push({
                    playerId,
                    oldRank: null,
                    newRank,
                    improved: true
                });
            }
        }
    }

    return changes;
};

/**
 * Sends a single Web Push notification payload to a subscription endpoint.
 *
 * @param {object} env Worker environment
 * @param {{ endpoint: string, p256dh: string, auth: string }} subscription
 * @param {{ title: string, body: string, url?: string }} payload
 */
export const sendPushNotification = async (env, subscription, payload) => {
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    const vapidSubject = env.VAPID_SUBJECT || 'mailto:admin@stpaulsleague.joelheath.net';

    if (!vapidPublicKey || !vapidPrivateKey) {
        console.warn('[Push] VAPID keys not configured in environment. Skipping notification.');
        return { success: false, reason: 'missing_keys' };
    }

    try {
        const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth
            }
        };

        const pushPayload = await buildPushPayload(
            { data: payload },
            pushSubscription,
            {
                subject: vapidSubject,
                publicKey: vapidPublicKey,
                privateKey: vapidPrivateKey
            }
        );

        const response = await fetch(subscription.endpoint, {
            method: pushPayload.method,
            headers: pushPayload.headers,
            body: pushPayload.body
        });

        // If the subscription has expired or unsubscribed, prune it from D1
        if (response.status === 404 || response.status === 410) {
            console.log(`[Push] Pruning expired subscription for endpoint: ${subscription.endpoint}`);
            if (env.DB) {
                await deletePushSubscription(env.DB, subscription.endpoint).catch((err) =>
                    console.error('[Push] Failed to delete expired subscription:', err)
                );
            }
            return { success: false, status: response.status, expired: true };
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`[Push] Delivery failed with status ${response.status}: ${errorText}`);
            return { success: false, status: response.status, errorText };
        }

        return { success: true, status: response.status };
    } catch (error) {
        console.error('[Push] Error sending push notification:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Notifies players whose leaderboard ranks have changed.
 *
 * @param {object} env Worker environment
 * @param {Array<{ playerId: string, oldRank: number|null, newRank: number, improved: boolean }>} rankChanges
 */
export const notifyRankChanges = async (env, rankChanges) => {
    if (!rankChanges || rankChanges.length === 0) return;

    for (const change of rankChanges) {
        let title;
        let body;

        if (change.oldRank === null) {
            title = '🎱 Leaderboard Position';
            body = `New position: #${change.newRank} on the leaderboard!`;
        } else if (change.improved) {
            title = '🏆 Leaderboard Rank Up!';
            body = `New position: #${change.newRank}! You moved up from #${change.oldRank}.`;
        } else {
            title = '📉 Leaderboard Position Changed';
            body = `New position: #${change.newRank}. You dropped from #${change.oldRank}.`;
        }

        const subscriptions = await getPushSubscriptionsForUser(env.DB, change.playerId);
        if (!subscriptions || subscriptions.length === 0) continue;

        const payload = {
            title,
            body,
            url: '/'
        };

        await Promise.allSettled(
            subscriptions.map((sub) => sendPushNotification(env, sub, payload))
        );
    }
};

/**
 * Sends an immediate test notification to a specific user.
 *
 * @param {object} env
 * @param {string} userId
 */
export const sendTestNotification = async (env, userId) => {
    const subscriptions = await getPushSubscriptionsForUser(env.DB, userId);
    if (!subscriptions || subscriptions.length === 0) {
        throw new Error('No push subscriptions registered for this user.');
    }

    const payload = {
        title: "🎱 St Paul's League",
        body: 'Push notifications are active! You will be notified whenever your leaderboard rank changes.',
        url: '/'
    };

    const results = await Promise.allSettled(
        subscriptions.map((sub) => sendPushNotification(env, sub, payload))
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value?.success).length;
    return {
        total: subscriptions.length,
        successful
    };
};
