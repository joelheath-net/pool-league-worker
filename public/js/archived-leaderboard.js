let currentArchivedPlayers = [];

async function populateArchive() {
    const container = document.querySelector('.container');
    const seasonId = container?.dataset?.seasonId;
    const tableBody = document.querySelector('#archive-body');
    const seasonNameEl = document.querySelector('#season-name');

    try {
        const response = await fetch(`/api/archive/${seasonId}`);
        if (!response.ok) throw new Error('Failed to fetch archive data');
        const { seasonInfo, leaderboard } = await response.json();

        if (seasonNameEl) {
            seasonNameEl.textContent = seasonInfo?.name || 'Archived Season';
        }

        currentArchivedPlayers = leaderboard.map(playerStats => {
            const played = playerStats.wins + playerStats.losses;
            const winLossRatio = playerStats.losses > 0
                ? (playerStats.wins / playerStats.losses).toFixed(2)
                : (playerStats.wins > 0 ? "∞" : "0.00");
            const ratioNumeric = playerStats.losses > 0
                ? (playerStats.wins / playerStats.losses)
                : (playerStats.wins > 0 ? Infinity : 0);
            const color = playerStats.teamColor || '#ffffff';
            const textColor = getContrastingTextColor(color);

            return {
                ...playerStats,
                played,
                winLossRatio,
                ratioNumeric,
                color,
                textColor
            };
        });

        setupLeaderboardControls({
            getData: () => currentArchivedPlayers,
            onRender: (sorted) => renderLeaderboardRows(sorted, '#archive-body')
        });

    } catch (error) {
        console.error('Error building archive:', error);
        if (seasonNameEl) seasonNameEl.textContent = 'Archive Not Found';
        if (tableBody) {
            tableBody.innerHTML = html`<tr><td colspan="9"><div class="table-cell">Failed to load archive.</div></td></tr>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', populateArchive);