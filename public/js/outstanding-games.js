/**
 * Fetches outstanding games from /api/outstanding-games and populates the table.
 */
async function populateOutstandingGames() {
    const tableBody = document.querySelector('#outstanding-games-body');
    const container = document.querySelector('.container');
    const summaryBanner = document.querySelector('#fixtures-summary');
    const isParticipating = container && container.dataset.isParticipating === 'true';

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
            tableBody.innerHTML = html`<tr><td colspan="${isParticipating ? 4 : 3}" style="text-align: center;"><div class="table-cell">No outstanding games found.</div></td></tr>`;
            return;
        }

        // Render rows
        const rowsHtml = games.map(game => {
            const homePlayer = game.homePlayer;
            const awayPlayer = game.awayPlayer;

            const homeColor = getContrastingTextColor(homePlayer.teamColor || '#ffffff');
            const awayColor = getContrastingTextColor(awayPlayer.teamColor || '#ffffff');

            const logUrl = `/log-game?homePlayerId=${encodeURIComponent(homePlayer.id)}&awayPlayerId=${encodeURIComponent(awayPlayer.id)}`;

            return eta.render(html`
                <tr>
                    <td style="background-color: {{= it.homePlayer.teamColor }};">
                        <div class="table-cell" style="color: {{= it.homeColor }};">
                            {{= it.homePlayer.name }} ({{= it.homePlayer.team }})
                        </div>
                    </td>
                    <td style="background-color: {{= it.awayPlayer.teamColor }};">
                        <div class="table-cell" style="color: {{= it.awayColor }};">
                            {{= it.awayPlayer.name }} ({{= it.awayPlayer.team }})
                        </div>
                    </td>
                    <td>
                        <div class="table-cell">
                            {{= it.roundName }}
                        </div>
                    </td>
                    ${isParticipating
                        ? html`<td><div class="table-cell"><a href="{{= it.logUrl }}" class="button-small">Log Game</a></div></td>`
                        : ''}
                </tr>
            `, {
                homePlayer,
                awayPlayer,
                homeColor,
                awayColor,
                roundName: game.roundName,
                logUrl
            });
        }).join('');

        tableBody.innerHTML = rowsHtml;
    } catch (error) {
        console.error('Error populating outstanding games:', error);
        if (summaryBanner) {
            summaryBanner.style.display = 'block';
            summaryBanner.innerHTML = html`<p>${escapeHTML(error.message)}</p>`;
        }
        tableBody.innerHTML = html`<tr><td colspan="${isParticipating ? 4 : 3}" style="text-align: center;"><div class="table-cell">${escapeHTML(error.message)}</div></td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', populateOutstandingGames);
