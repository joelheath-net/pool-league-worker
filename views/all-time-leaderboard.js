export const AllTimeLeaderboardPage = () => {
    return (
        <div class="container">
            <h1 class="centre-title leaderboard-title">All-Time Leaderboard</h1>

            <div class="leaderboard-wrapper">
                <div class="leaderboard-controls">
                    <div class="sort-panel" id="sort-panel">
                        <div class="sort-control">
                            <label for="sort-select" class="sort-label">Sort by:</label>
                            <select id="sort-select" class="sort-select">
                                <option value="points" selected>Points</option>
                                <option value="winLossRatio">Win:Loss Ratio</option>
                                <option value="wins">Wins</option>
                                <option value="losses">Losses</option>
                                <option value="foulsOnBlack">Fouls on Black</option>
                                <option value="ballsRemaining">Ball Difference</option>
                                <option value="played">Matches Played</option>
                            </select>
                            <button id="sort-order-btn" class="sort-order-btn sort-desc" type="button" aria-label="Toggle sort order" title="Descending order (click for ascending)">
                                <span id="sort-order-icon">&darr;</span>
                            </button>
                        </div>
                    </div>
                    <button id="sort-toggle-btn" class="sort-toggle-btn" type="button" aria-label="Toggle sort options" title="Show sorting options">
                        <svg class="sort-chevron-icon" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                </div>

                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col" class="sticky" style="background-color: #e9ecef;"><div class="table-cell">Player</div></th>
                                <th scope="col"><div class="table-cell">Team Name</div></th>
                                <th scope="col"><div class="table-cell">Points</div></th>
                                <th scope="col"><div class="table-cell">Wins</div></th>
                                <th scope="col"><div class="table-cell">Losses</div></th>
                                <th scope="col"><div class="table-cell">Fouls on Black</div></th>
                                <th scope="col"><div class="table-cell">Ball Difference</div></th>
                                <th scope="col"><div class="table-cell">Played</div></th>
                                <th scope="col"><div class="table-cell">Win:Loss Ratio</div></th>
                            </tr>
                        </thead>
                        <tbody id="all-time-body">
                            <tr>
                                <td colspan="9" style="text-align: center;">
                                    <div class="table-cell">Loading all-time stats...</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
