export const GamesPage = () => {
    return (
        <div class="container">
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
                            <th><div class="table-cell">Edit</div></th>
                        </tr>
                    </thead>
                    <tbody id="games-list-body">
                        <tr>
                            <td colspan="7" style="text-align: center;">Loading game history...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};