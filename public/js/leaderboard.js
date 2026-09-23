let currentLeaderboardPlayers = [];

async function populateLeaderboard() {
    const tableBody = document.querySelector('#leaderboard-body');

    try {
        // 1. Fetch main leaderboard stats
        const leaderboardResponse = await fetch('/api/leaderboard');
        if (!leaderboardResponse.ok) throw new Error('Failed to fetch leaderboard');
        const leaderboardData = await leaderboardResponse.json();

        // 2. Fetch user details and compile full player objects
        const playersWithUsers = await Promise.all(leaderboardData.map(async (playerStats) => {
            const userResponse = await fetch(`/api/users/${playerStats.playerId}`);
            const userData = userResponse.ok ? await userResponse.json() : {};

            const points = playerStats.wins * 3 + playerStats.losses - playerStats.foulsOnBlack;
            const played = playerStats.wins + playerStats.losses;
            const winLossRatio = playerStats.losses > 0
                ? (playerStats.wins / playerStats.losses).toFixed(2)
                : (playerStats.wins > 0 ? "∞" : "0.00");
            const ratioNumeric = playerStats.losses > 0
                ? (playerStats.wins / playerStats.losses)
                : (playerStats.wins > 0 ? Infinity : 0);
            const color = userData.teamColor || '#ffffff';
            const textColor = getContrastingTextColor(color);

            return {
                ...userData,
                ...playerStats,
                points,
                played,
                winLossRatio,
                ratioNumeric,
                color,
                textColor
            };
        }));

        currentLeaderboardPlayers = playersWithUsers.filter(Boolean);

        // 3. Setup controls and render table
        setupLeaderboardControls({
            getData: () => currentLeaderboardPlayers,
            onRender: (sorted) => renderLeaderboardRows(sorted, '#leaderboard-body')
        });

    } catch (error) {
        console.error('Error building leaderboard:', error);
        if (tableBody) {
            tableBody.innerHTML = html`<tr><td colspan="9"><div class="table-cell">Failed to load leaderboard.</div></td></tr>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', populateLeaderboard);