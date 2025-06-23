const html = (strings, ...values) => String.raw({ raw: strings }, ...values);

function getContrastingTextColor(hexColor) {
    // Remove the hash at the start if it's there
    hexColor = hexColor.replace(/^#/, '');

    // Parse the R, G, B values
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);

    // Calculate the perceptive luminance (aka luma) - human eye perception
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for bright colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Fetches all games and users, then populates the history table.
 */
async function populateGameList() {
    const tableBody = document.getElementById('games-list-body');
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
                tableBody.innerHTML = html`<tr><td colspan="7" style="text-align: center;"><div class="table-cell">No games have been logged yet.</div></td></tr>`;
                return;
        }

        // 3. Process each game and create its table row HTML
        const rowsHtml = games.map(game => {
            // Determine loser ID
            const loser_id = game.winner_id === game.player1_id ? game.player2_id : game.player1_id;
            
            // Get user objects from the map
            const winner = userMap.get(game.winner_id);
            const loser = userMap.get(loser_id);

            // Default user object to prevent errors if a user is not found
            const unknownUser = { name: 'Unknown', team: 'N/A', team_color: '#ffffff' };
            const winnerInfo = winner || unknownUser;
            const loserInfo = loser || unknownUser;

            // Format data for display
            const playedDate = new Date(game.played_at).toLocaleDateString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
            const fouledText = game.fouled_on_black ? 'Yes' : 'No';
            const rematchText = game.rematch_id === 0 ? 'First Match' : `Rematch ${game.rematch_id}`;
            
            // Construct the edit link with query parameters
            const editUrl = `/edit-game?player1_id=${game.player1_id}&player2_id=${game.player2_id}&rematch_id=${game.rematch_id}`;


            const winnerColor = getContrastingTextColor(winnerInfo.team_color);            
            const loserColor = getContrastingTextColor(loserInfo.team_color);

            

            return html`
                <tr>
                    <td><div class="table-cell">${playedDate}</div></td>
                    <td style="background-color: ${winnerInfo.team_color};"><div class="table-cell" style="color: ${winnerColor}">${winnerInfo.name} (${winnerInfo.team})</div></td>
                    <td style="background-color: ${loserInfo.team_color};"><div class="table-cell" style="color: ${loserColor}">${loserInfo.name} (${loserInfo.team})</div></td>
                    <td><div class="table-cell">${fouledText}</div></td>
                    <td><div class="table-cell">${game.balls_remaining}</div></td>
                    <td><div class="table-cell">${rematchText}</div></td>
                    <td><div class="table-cell"><a href="${editUrl}">Edit</a></div></td>
                </tr>
            `;
        }).join('');

        // 4. Populate the table body
        tableBody.innerHTML = rowsHtml;

    } catch (error) {
        console.error("Error populating game list:", error);
        tableBody.innerHTML = html`<tr><td colspan="7" style="text-align: center;"><div class="table-cell">Failed to load game history.</div></td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', populateGameList);