export const OutstandingGamesPage = ({ rounds = 2, prioritiseFirstMatchups = true, isParticipating = false }) => {
    return (
        <div
            class="container"
            data-is-participating={isParticipating}
            data-rounds={rounds}
            data-prioritise-first-matchups={prioritiseFirstMatchups}
        >
            <div class="centre-container">
                <h1 class="centre-title">Outstanding Games</h1>
                <div class="fixtures-controls-card">
                    <form id="outstanding-games-form" action="/outstanding-games" method="GET" class="fixtures-controls-form">
                        <div class="fixtures-top-controls">
                            <div class="fixtures-rounds-group">
                                <label for="rematch-rounds-input" class="fixtures-controls-label">
                                    Rematch Rounds:
                                </label>
                                <input
                                    type="number"
                                    id="rematch-rounds-input"
                                    name="rounds"
                                    min="1"
                                    max="99"
                                    value={rounds}
                                    class="fixtures-rounds-input"
                                    required
                                />
                            </div>

                            <label for="prioritise-first-matchups" class="fixtures-toggle-label">
                                <input
                                    type="checkbox"
                                    id="prioritise-first-matchups"
                                    name="prioritiseFirstMatchups"
                                    value="true"
                                    checked={prioritiseFirstMatchups}
                                />
                                <span>Prioritise first matchups</span>
                            </label>
                        </div>

                        <details id="available-players-details" class="available-players-details">
                            <summary class="available-players-summary">
                                <span class="available-players-summary-title">Available Players</span>
                                <span class="available-players-summary-meta">
                                    <span id="available-players-count" class="available-players-badge">All available</span>
                                    <svg class="available-players-chevron" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </span>
                            </summary>
                            <div class="available-players-panel">
                                <div class="available-players-actions">
                                    <button type="button" id="select-all-players-btn" class="available-players-action-btn">Select All</button>
                                    <button type="button" id="deselect-all-players-btn" class="available-players-action-btn">Deselect All</button>
                                </div>
                                <div id="available-players-list" class="available-players-grid">
                                    <div class="available-players-loading">Loading players...</div>
                                </div>
                            </div>
                        </details>

                        <button type="submit" class="button-primary fixtures-submit-btn">Calculate Outstanding Games</button>
                    </form>
                </div>
                <div id="fixtures-summary" class="fixtures-summary-banner" style="display: none;"></div>
            </div>

            <div class="table-container" data-nosnippet>
                <table>
                    <thead>
                        <tr>
                            <th scope="col"><div class="table-cell">Player 1</div></th>
                            <th scope="col"><div class="table-cell">Player 2</div></th>
                            <th scope="col"><div class="table-cell">Rematch Round</div></th>
                            {isParticipating
                                ? <th scope="col"><div class="table-cell">Log Game</div></th>
                                : ''}
                        </tr>
                    </thead>
                    <tbody id="outstanding-games-body">
                        <tr>
                            <td colspan={isParticipating ? 4 : 3} style="text-align: center;">
                                <div class="table-cell">Calculating outstanding games...</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="text-align: center; margin-top: 24px; margin-bottom: 24px;">
                <a href="/game-list" class="secondary-link">Back to Game History</a>
            </div>
        </div>
    );
};
