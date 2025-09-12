async function populateArchive() {
    const container = document.querySelector('.container');
    const seasonId = container.dataset.seasonId;
    const tableBody = document.getElementById('archive-body');
    const seasonNameEl = document.getElementById('season-name');

    try {
        const response = await fetch(`/api/archive/${seasonId}`);
        if (!response.ok) throw new Error('Failed to fetch archive data');
        const { seasonInfo, leaderboard } = await response.json();

        seasonNameEl.textContent = seasonInfo.name;

        // Sort data by points
        leaderboard.sort((a, b) => b.points - a.points);

        const rowsHtml = leaderboard.map(playerStats => {
            const color = playerStats.team_color || '#ffffff';
            const textColor = getContrastingTextColor(color);
            const winLossRatio = playerStats.losses > 0 ? (playerStats.wins / playerStats.losses).toFixed(2) : (playerStats.wins > 0 ? "∞" : "0.00");

            return eta.render(html`
                <tr>
                    <td class="sticky" style="background-color: {{= it.color }}"><div class="table-cell" style="color: {{= it.textColor }}">{{= it.name }}</div></td>
                    <td style="background-color: {{= it.color }}"><div class="table-cell" style="color: {{= it.textColor }}">{{= it.team }}</div></td>
                    <td><div class="table-cell">{{= it.points }}</div></td>
                    <td><div class="table-cell">{{= it.wins }}</div></td>
                    <td><div class="table-cell">{{= it.losses }}</div></td>
                    <td><div class="table-cell">{{= it.fouls_on_black }}</div></td>
                    <td><div class="table-cell">{{= it.balls_remaining }}</div></td>
                    <td><div class="table-cell">{{= it.winLossRatio }}</div></td>
                </tr>
            `, { ...playerStats, color, textColor, winLossRatio });
        }).join('');

        tableBody.innerHTML = rowsHtml;
    } catch (error) {
        console.error('Error building archive:', error);
        seasonNameEl.textContent = 'Archive Not Found';
        tableBody.innerHTML = html`<tr><td colspan="7"><div class="table-cell">Failed to load archive.</div></td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', populateArchive);