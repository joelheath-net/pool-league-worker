/**
 * Fetches all games and users, then populates the history table.
 */
async function populateGameList() {
    const tableBody = document.querySelector('#games-list-body');
    const container = document.querySelector('.container');
    const isAuthenticated = container && container.dataset.isAuthenticated === 'true';

    //tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading game history...</td></tr>';

    try {
        // 1. Fetch users and games in parallel for efficiency
        const [usersResponse, gamesResponse] = await Promise.all([
            fetch('/api/users'),
            fetch('/api/game-list')
        ]);

        if (!usersResponse.ok || !gamesResponse.ok) {
            throw new Error('Failed to fetch required data.');
        }

        const users = await usersResponse.json();
        const games = await gamesResponse.json();

        // 2. Create a user lookup map for fast, easy access (O(1) lookup).
        // This fulfills the "fetch users once" requirement.
        const userMap = new Map(users.map(user => [user.id, user]));

        if (games.length === 0) {
                tableBody.innerHTML = html`<tr><td colspan="${isAuthenticated ? 7 : 6}" style="text-align: center;"><div class="table-cell">No games have been logged yet.</div></td></tr>`;
                return;
        }

        // 3. Process each game and create its table row HTML
        const rowsHtml = games.map(game => {
            // Determine loser ID
            const loserId = game.winnerId === game.player1Id ? game.player2Id : game.player1Id;
            
            // Get user objects from the map
            const winner = userMap.get(game.winnerId);
            const loser = userMap.get(loserId);

            // Default user object to prevent errors if a user is not found
            const unknownUser = { name: 'Unknown', team: 'N/A', teamColor: '#ffffff' };
            const winnerInfo = winner || unknownUser;
            const loserInfo = loser || unknownUser;

            // Format data for display
            const playedDate = new Date(game.playedAt).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            const fouledText = game.fouledOnBlack ? 'Yes' : 'No';
            const rematchText = game.rematchId === 0 ? 'First Match' : eta.render(`Rematch {{= it.rematchId }}`, game);

            // Construct the edit link with query parameters
            const editUrl = `/edit-game?player1=${game.player1Id}&player2=${game.player2Id}&rematch=${game.rematchId}`;

            const winnerColor = getContrastingTextColor(winnerInfo.teamColor);
            const loserColor = getContrastingTextColor(loserInfo.teamColor);

            return eta.render(html`
                <tr>
                    <td><div class="table-cell">{{= it.playedDate }}</div></td>
                    <td style="background-color: {{= it.winnerInfo.teamColor }};"><div class="table-cell" style="color: {{= it.winnerColor }}">{{= it.winnerInfo.name }} ({{= it.winnerInfo.team }})</div></td>
                    <td style="background-color: {{= it.loserInfo.teamColor }};"><div class="table-cell" style="color: {{= it.loserColor }}">{{= it.loserInfo.name }} ({{= it.loserInfo.team }})</div></td>
                    <td><div class="table-cell">{{= it.fouledText }}</div></td>
                    <td><div class="table-cell">{{= it.ballsRemaining }}</div></td>
                    <td><div class="table-cell">{{= it.rematchText }}</div></td>
                    ${isAuthenticated 
                        ? html`<td><div class="table-cell"><a href="{{= it.editUrl }}">Edit</a></div></td>` 
                        : ''}
                </tr>
            `, { playedDate, winnerInfo, loserInfo, fouledText, rematchText, ...game, winnerColor, loserColor, editUrl });
        }).join('');

        // 4. Populate the table body
        tableBody.innerHTML = rowsHtml;

    } catch (error) {
        console.error("Error populating game list:", error);
        tableBody.innerHTML = html`<tr><td colspan="${isAuthenticated ? 7 : 6}" style="text-align: center;"><div class="table-cell">Failed to load game history.</div></td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', populateGameList);