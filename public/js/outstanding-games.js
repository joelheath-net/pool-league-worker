/**
 * Fetches outstanding games from /api/outstanding-games and populates the table.
 */
async function populateOutstandingGames() {
    const tableBody = document.querySelector('#outstanding-games-body');
    const container = document.querySelector('.container');
    const summaryBanner = document.querySelector('#fixtures-summary');
    const isAuthenticated = container && container.dataset.isAuthenticated === 'true';

    // Get rounds from URL search params or data attribute
    const urlParams = new URLSearchParams(window.location.search);
    const roundsParam = urlParams.get('rounds') || (container && container.dataset.rounds) || '2';

    try {
        const response = await fetch(`/api/outstanding-games?rounds=${encodeURIComponent(roundsParam)}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to calculate outstanding games.');
        }

        const data = await response.json();
        const { games, totalOutstanding, rematchRounds, participatingCount, limit } = data;

        // Update summary banner
        if (summaryBanner) {
            summaryBanner.style.display = 'block';
            if (participatingCount < 2) {
                summaryBanner.innerHTML = html`<p>At least 2 participating players are required to schedule games.</p>`;
            } else if (totalOutstanding === 0) {
                summaryBanner.innerHTML = html`<p>All games have been completed for ${escapeHTML(rematchRounds)} rematch rounds.</p>`;
            } else if (totalOutstanding > limit) {
                summaryBanner.innerHTML = html`<p>Showing next ${games.length} of ${escapeHTML(totalOutstanding)} outstanding games for ${escapeHTML(participatingCount)} participating players.</p>`;
            } else {
                summaryBanner.innerHTML = html`<p>Showing all ${escapeHTML(totalOutstanding)} outstanding games for ${escapeHTML(participatingCount)} participating players.</p>`;
            }
        }

        if (!games || games.length === 0) {
            tableBody.innerHTML = html`<tr><td colspan="${isAuthenticated ? 4 : 3}" style="text-align: center;"><div class="table-cell">No outstanding games found.</div></td></tr>`;
            return;
        }

        // Render rows
        const rowsHtml = games.map(game => {
            const p1 = game.player1;
            const p2 = game.player2;

            const p1Color = getContrastingTextColor(p1.teamColor || '#ffffff');
            const p2Color = getContrastingTextColor(p2.teamColor || '#ffffff');

            const logUrl = `/log-game?player1=${encodeURIComponent(p1.id)}&player2=${encodeURIComponent(p2.id)}`;

            return eta.render(html`
                <tr>
                    <td style="background-color: {{= it.p1.teamColor }};">
                        <div class="table-cell" style="color: {{= it.p1Color }};">
                            {{= it.p1.name }} ({{= it.p1.team }})
                        </div>
                    </td>
                    <td style="background-color: {{= it.p2.teamColor }};">
                        <div class="table-cell" style="color: {{= it.p2Color }};">
                            {{= it.p2.name }} ({{= it.p2.team }})
                        </div>
                    </td>
                    <td>
                        <div class="table-cell">
                            {{= it.roundName }}
                        </div>
                    </td>
                    ${isAuthenticated
                        ? html`<td><div class="table-cell"><a href="{{= it.logUrl }}" class="button-small">Log Game</a></div></td>`
                        : ''}
                </tr>
            `, {
                p1,
                p2,
                p1Color,
                p2Color,
                roundName: game.roundName,
                logUrl
            });
        }).join('');

        tableBody.innerHTML = rowsHtml;

    } catch (error) {
        console.error("Error populating outstanding games:", error);
        if (summaryBanner) {
            summaryBanner.style.display = 'block';
            summaryBanner.innerHTML = html`<p>${escapeHTML(error.message)}</p>`;
        }
        tableBody.innerHTML = html`<tr><td colspan="${isAuthenticated ? 4 : 3}" style="text-align: center;"><div class="table-cell">${escapeHTML(error.message)}</div></td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', populateOutstandingGames);
