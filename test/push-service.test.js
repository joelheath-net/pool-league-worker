import { describe, it, expect } from 'vitest';
import { diffRankings } from '../src/push-service.js';

describe('Push Service - diffRankings', () => {
    it('detects rank improvements and drops correctly', () => {
        const oldRanks = {
            'player-1': 1,
            'player-2': 2,
            'player-3': 3,
            'player-4': 4
        };

        // player-3 beats someone and climbs to #2; player-2 drops to #3; 1 and 4 stay unchanged
        const newRanks = {
            'player-1': 1,
            'player-2': 3,
            'player-3': 2,
            'player-4': 4
        };

        const changes = diffRankings(oldRanks, newRanks);

        expect(changes).toHaveLength(2);

        const player3Change = changes.find((c) => c.playerId === 'player-3');
        expect(player3Change).toEqual({
            playerId: 'player-3',
            oldRank: 3,
            newRank: 2,
            improved: true
        });

        const player2Change = changes.find((c) => c.playerId === 'player-2');
        expect(player2Change).toEqual({
            playerId: 'player-2',
            oldRank: 2,
            newRank: 3,
            improved: false
        });
    });

    it('returns empty array when no ranks have changed', () => {
        const ranks = {
            'player-1': 1,
            'player-2': 2
        };
        const changes = diffRankings(ranks, ranks);
        expect(changes).toEqual([]);
    });

    it('handles new players entering the leaderboard', () => {
        const oldRanks = {
            'player-1': 1
        };
        const newRanks = {
            'player-1': 1,
            'player-new': 2
        };

        const changes = diffRankings(oldRanks, newRanks);
        expect(changes).toHaveLength(1);
        expect(changes[0]).toEqual({
            playerId: 'player-new',
            oldRank: null,
            newRank: 2,
            improved: true
        });
    });
});
