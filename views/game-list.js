export const GamesPage = ({ isAuthenticated }) => {
    const colspan = isAuthenticated ? 7 : 6;

    return (
        <div class="container" data-is-authenticated={isAuthenticated}>
            <h1 class="centre-title">Game History</h1>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th><div class="table-cell">Date</div></th>
                            <th><div class="table-cell">Winner</div></th>
                            <th><div class="table-cell">Loser</div></th>
                            <th><div class="table-cell">Fouled on Black</div></th>
                            <th><div class="table-cell">Balls Remaining</div></th>
                            <th><div class="table-cell">Rematch Round</div></th>
                            {isAuthenticated
                                ? <th><div class="table-cell">Edit</div></th>
                                : ''}
                        </tr>
                    </thead>
                    <tbody id="games-list-body">
                        <tr>
                            <td colspan={colspan} style="text-align: center;"><div class="table-cell">Loading game history...</div></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};