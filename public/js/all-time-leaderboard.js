let allTimePlayers = [];

async function loadAllTimeLeaderboard() {
    const tableBody = document.querySelector('#all-time-body');

    try {
        const response = await fetch('/api/all-time-leaderboard');
        if (!response.ok) throw new Error('Failed to fetch all-time leaderboard data');
        allTimePlayers = await response.json();

        setupLeaderboardControls({
            getData: () => allTimePlayers,
            onRender: (sorted) => renderLeaderboardRows(sorted, '#all-time-body')
        });

    } catch (error) {
        console.error('Error loading all-time leaderboard:', error);
        if (tableBody) {
            tableBody.innerHTML = html`
                <tr>
                    <td colspan="9" style="text-align: center; color: #dc3545; padding: 20px 0;">
                        <div class="table-cell">Failed to load all-time leaderboard.</div>
                    </td>
                </tr>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', loadAllTimeLeaderboard);
