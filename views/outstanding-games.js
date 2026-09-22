export const OutstandingGamesPage = ({ rounds = 2, isAuthenticated = false }) => {
    return (
        <div class="container" data-is-authenticated={isAuthenticated} data-rounds={rounds}>
            <div class="centre-container">
                <h1 class="centre-title">Outstanding Games</h1>
                <div class="fixtures-controls-card">
                    <form action="/outstanding-games" method="GET" class="fixtures-controls-form">
                        <label for="rematch-rounds-input" class="fixtures-controls-label">
                            Rematch Rounds:
                        </label>
                        <div class="fixtures-controls-inline">
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
                            <button type="submit" class="button-primary">Determine Outstanding Games</button>
                        </div>
                    </form>
                </div>
                <div id="fixtures-summary" class="fixtures-summary-banner" style="display: none;"></div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th><div class="table-cell">Player 1</div></th>
                            <th><div class="table-cell">Player 2</div></th>
                            <th><div class="table-cell">Rematch Round</div></th>
                            {isAuthenticated
                                ? <th><div class="table-cell">Log Game</div></th>
                                : ''}
                        </tr>
                    </thead>
                    <tbody id="outstanding-games-body">
                        <tr>
                            <td colspan={isAuthenticated ? 4 : 3} style="text-align: center;">
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
