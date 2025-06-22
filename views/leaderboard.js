export const LeaderboardPage = () => {
    return (
        <div class="container">
            <h1 class="centre-title">Current Standings</h1>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th class="sticky" style="background-color: #e9ecef;" ><div class="table-cell">Player</div></th>
                            <th><div class="table-cell">Team Name</div></th>
                            <th><div class="table-cell">Points</div></th>
                            <th><div class="table-cell">Wins</div></th>
                            <th><div class="table-cell">Losses</div></th>
                            <th><div class="table-cell">Fouls on Black</div></th>
                            <th><div class="table-cell">Ball Difference</div></th>
                            <th><div class="table-cell">Played</div></th>
                            <th><div class="table-cell">Win:Loss Ratio</div></th>
                        </tr>
                    </thead>
                    <tbody id="leaderboard-body">
                        <tr>
                            <td colspan="9" style="text-align: center;">
                                <div class="table-cell">Loading...</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};