let playersInitialized = false;

function getAvailableCheckboxes() {
    return Array.from(document.querySelectorAll('.available-player-checkbox'));
}

function updateAvailablePlayersBadge() {
    const badge = document.querySelector('#available-players-count');
    if (!badge) return;

    const checkboxes = getAvailableCheckboxes();
    if (checkboxes.length === 0) {
        badge.textContent = '0 available';
        badge.classList.remove('is-filtered');
        return;
    }

    const checkedCount = checkboxes.filter((cb) => cb.checked).length;
    if (checkedCount === checkboxes.length) {
        badge.textContent = `All available (${checkboxes.length})`;
        badge.classList.remove('is-filtered');
    } else {
        badge.textContent = `${checkedCount} / ${checkboxes.length} available`;
        badge.classList.add('is-filtered');
    }
}

function renderAvailablePlayersList(players, initialAvailableSet) {
    const listContainer = document.querySelector('#available-players-list');
    if (!listContainer) return;

    if (!Array.isArray(players) || players.length === 0) {
        listContainer.innerHTML = html`<div class="available-players-empty">No participating players found.</div>`;
        updateAvailablePlayersBadge();
        return;
    }

    listContainer.innerHTML = players.map((player) => {
        const isChecked = initialAvailableSet ? initialAvailableSet.has(player.id) : true;
        const teamColor = player.teamColor || '#ffffff';
        return html`
            <label class="available-player-item">
                <input
                    type="checkbox"
                    class="available-player-checkbox"
                    value="${escapeHTML(player.id)}"
                    ${isChecked ? 'checked' : ''}
                />
                <span class="available-player-swatch" style="background-color: ${escapeHTML(teamColor)};"></span>
                <span class="available-player-info">
                    <span class="available-player-name">${escapeHTML(player.name)}</span>
                    <span class="available-player-team">${escapeHTML(player.team)}</span>
                </span>
            </label>
        `;
    }).join('');

    updateAvailablePlayersBadge();
}

function syncUrlWithControls() {
    const roundsInput = document.querySelector('#rematch-rounds-input');
    const prioritiseToggle = document.querySelector('#prioritise-first-matchups');
    const params = new URLSearchParams();

    const roundsVal = (roundsInput && roundsInput.value.trim()) || '2';
    params.set('rounds', roundsVal);

    if (prioritiseToggle && !prioritiseToggle.checked) {
        params.set('prioritiseFirstMatchups', 'false');
    }

    if (playersInitialized) {
        const checkboxes = getAvailableCheckboxes();
        if (checkboxes.length > 0) {
            const checkedIds = checkboxes.filter((cb) => cb.checked).map((cb) => cb.value);
            if (checkedIds.length < checkboxes.length) {
                params.set('available', checkedIds.join(','));
            }
        }
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
}

/**
 * Fetches outstanding games from /api/outstanding-games and populates the table.
 */
async function populateOutstandingGames() {
    const tableBody = document.querySelector('#outstanding-games-body');
    const container = document.querySelector('.container');
    const summaryBanner = document.querySelector('#fixtures-summary');
    const roundsInput = document.querySelector('#rematch-rounds-input');
    const prioritiseToggle = document.querySelector('#prioritise-first-matchups');
    const isParticipating = container && container.dataset.isParticipating === 'true';

    const urlParams = new URLSearchParams(window.location.search);
    const roundsParam = (roundsInput && roundsInput.value.trim())
        || urlParams.get('rounds')
        || (container && container.dataset.rounds)
        || '2';
    const prioritiseFirstMatchups = prioritiseToggle ? prioritiseToggle.checked : true;

    const apiParams = new URLSearchParams();
    apiParams.set('rounds', roundsParam);
    apiParams.set('prioritiseFirstMatchups', String(prioritiseFirstMatchups));

    if (playersInitialized) {
        const checkboxes = getAvailableCheckboxes();
        if (checkboxes.length > 0) {
            const checkedIds = checkboxes.filter((cb) => cb.checked).map((cb) => cb.value);
            if (checkedIds.length < checkboxes.length) {
                apiParams.set('available', checkedIds.join(','));
            }
        }
    } else if (urlParams.has('available')) {
        apiParams.set('available', urlParams.get('available'));
    } else if (urlParams.has('unavailable')) {
        apiParams.set('unavailable', urlParams.get('unavailable'));
    }

    try {
        const response = await fetch(`/api/outstanding-games?${apiParams.toString()}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Failed to calculate outstanding games.');
        }

        const data = await response.json();
        const {
            games,
            totalOutstanding,
            rematchRounds,
            participatingCount,
            availableCount,
            players,
            limit
        } = data;

        if (!playersInitialized && Array.isArray(players)) {
            let initialAvailableSet = null;
            if (urlParams.has('available')) {
                const raw = urlParams.get('available') || '';
                initialAvailableSet = new Set(
                    raw.split(',').map((s) => s.trim()).filter(Boolean)
                );
            } else if (urlParams.has('unavailable')) {
                const raw = urlParams.get('unavailable') || '';
                const unavailableSet = new Set(
                    raw.split(',').map((s) => s.trim()).filter(Boolean)
                );
                initialAvailableSet = new Set(
                    players.filter((p) => !unavailableSet.has(p.id)).map((p) => p.id)
                );
            }
            renderAvailablePlayersList(players, initialAvailableSet);
            playersInitialized = true;
        }

        const effectiveAvailableCount = typeof availableCount === 'number' ? availableCount : participatingCount;
        const isFilteredByAvailability = effectiveAvailableCount < participatingCount;

        // Update summary banner
        if (summaryBanner) {
            summaryBanner.style.display = 'block';
            if (participatingCount < 2) {
                summaryBanner.innerHTML = html`<p>At least 2 participating players are required to schedule games.</p>`;
            } else if (effectiveAvailableCount < 2) {
                summaryBanner.innerHTML = html`<p>At least 2 available players are required to schedule games.</p>`;
            } else if (totalOutstanding === 0) {
                if (isFilteredByAvailability) {
                    summaryBanner.innerHTML = html`<p>All games between the ${escapeHTML(effectiveAvailableCount)} available players have been completed for ${escapeHTML(rematchRounds)} rematch rounds.</p>`;
                } else {
                    summaryBanner.innerHTML = html`<p>All games have been completed for ${escapeHTML(rematchRounds)} rematch rounds.</p>`;
                }
            } else if (totalOutstanding > limit) {
                if (isFilteredByAvailability) {
                    summaryBanner.innerHTML = html`<p>Showing next ${games.length} of ${escapeHTML(totalOutstanding)} outstanding games for ${escapeHTML(effectiveAvailableCount)} of ${escapeHTML(participatingCount)} available players.</p>`;
                } else {
                    summaryBanner.innerHTML = html`<p>Showing next ${games.length} of ${escapeHTML(totalOutstanding)} outstanding games for ${escapeHTML(participatingCount)} participating players.</p>`;
                }
            } else {
                if (isFilteredByAvailability) {
                    summaryBanner.innerHTML = html`<p>Showing all ${escapeHTML(totalOutstanding)} outstanding games for ${escapeHTML(effectiveAvailableCount)} of ${escapeHTML(participatingCount)} available players.</p>`;
                } else {
                    summaryBanner.innerHTML = html`<p>Showing all ${escapeHTML(totalOutstanding)} outstanding games for ${escapeHTML(participatingCount)} participating players.</p>`;
                }
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

function initOutstandingGamesControls() {
    const form = document.querySelector('#outstanding-games-form');
    const roundsInput = document.querySelector('#rematch-rounds-input');
    const prioritiseToggle = document.querySelector('#prioritise-first-matchups');
    const listContainer = document.querySelector('#available-players-list');
    const selectAllBtn = document.querySelector('#select-all-players-btn');
    const deselectAllBtn = document.querySelector('#deselect-all-players-btn');

    const urlParams = new URLSearchParams(window.location.search);
    if (roundsInput && urlParams.has('rounds')) {
        roundsInput.value = urlParams.get('rounds');
    }
    if (prioritiseToggle && urlParams.has('prioritiseFirstMatchups')) {
        const param = urlParams.get('prioritiseFirstMatchups');
        prioritiseToggle.checked = param !== 'false' && param !== '0';
    }

    if (listContainer) {
        listContainer.addEventListener('change', (event) => {
            if (event.target.classList.contains('available-player-checkbox')) {
                updateAvailablePlayersBadge();
            }
        });
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            getAvailableCheckboxes().forEach((cb) => {
                cb.checked = true;
            });
            updateAvailablePlayersBadge();
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            getAvailableCheckboxes().forEach((cb) => {
                cb.checked = false;
            });
            updateAvailablePlayersBadge();
        });
    }

    if (prioritiseToggle) {
        prioritiseToggle.addEventListener('change', () => {
            syncUrlWithControls();
            populateOutstandingGames();
        });
    }

    if (form) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            syncUrlWithControls();
            populateOutstandingGames();
        });
    }

    populateOutstandingGames();
}

document.addEventListener('DOMContentLoaded', initOutstandingGamesControls);
