let currentLeaderboardPlayers = [];

async function populateLeaderboard() {
    const tableBody = document.querySelector('#leaderboard-body');

    try {
        const leaderboardResponse = await fetch('/api/leaderboard');
        if (!leaderboardResponse.ok) throw new Error('Failed to fetch leaderboard');
        currentLeaderboardPlayers = await leaderboardResponse.json();

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