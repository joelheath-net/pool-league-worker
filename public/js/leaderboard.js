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
 * Fetches all data and populates the leaderboard table.
 */
async function populateLeaderboard() {
    const tableBody = document.getElementById('leaderboard-body');

    try {
        // 1. Fetch the main leaderboard stats
        const leaderboardResponse = await fetch('/api/leaderboard');
        if (!leaderboardResponse.ok) throw new Error('Failed to fetch leaderboard');
        const leaderboardData = await leaderboardResponse.json();

        // 2. Pre-process data to calculate points for sorting
        const processedData = leaderboardData.map(playerStats => {
            const points = playerStats.wins * 3 + playerStats.losses - playerStats.fouls_on_black;
            return { ...playerStats, points }; // Add points to each player's object
        });

        // 3. Sort the data
        processedData.sort((a, b) => {
            // Primary sort: points descending
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            // Secondary sort: balls_remaining ascending
            if (a.balls_remaining !== b.balls_remaining) {
                return a.balls_remaining - b.balls_remaining;
            }
            // Tertiary sort: fouls_on_black ascending
            return a.fouls_on_black - b.fouls_on_black;
        });

        // 4. Generate HTML rows from the sorted data
        const rowsHtml = await Promise.all(processedData.map(async (playerStats) => {
            // For each player, fetch their user details
            const userResponse = await fetch(`/api/users/${playerStats.playerId}`);
            if (!userResponse.ok) {
                console.error(`Failed to fetch user data for ${playerStats.playerId}`);
                return ''; // Skip this player on error
            }
            const userData = await userResponse.json();

            // Calculate derived stats
            const played = playerStats.wins + playerStats.losses;
            // Handle division by zero for the win/loss ratio
            const winLossRatio = playerStats.losses > 0 ? (playerStats.wins / playerStats.losses).toFixed(2) : (playerStats.wins > 0 ? "∞" : "0.00");
            const color = userData.team_color || '#ffffff'; // Default to white if no color
            const textColor = getContrastingTextColor(color);

            const escapedName = escapeHTML(userData.name || 'N/A');
            const escapedTeam = escapeHTML(userData.team || 'N/A');

            // Create the HTML for the table row
            return html`
                <tr>
                    <td class="sticky" style="background-color: ${color};"><div class="table-cell" style="color: ${textColor}">${escapedName}</div></td>
                    <td style="background-color: ${color};"><div class="table-cell" style="color: ${textColor}">${escapedTeam}</div></td>
                    <td><div class="table-cell">${playerStats.points}</div></td>
                    <td><div class="table-cell">${playerStats.wins}</div></td>
                    <td><div class="table-cell">${playerStats.losses}</div></td>
                    <td><div class="table-cell">${playerStats.fouls_on_black}</div></td>
                    <td><div class="table-cell">${playerStats.balls_remaining}</div></td>
                    <td><div class="table-cell">${played}</div></td>
                    <td><div class="table-cell">${winLossRatio}</div></td>
                </tr>
            `;
        }));

        // 5. Update the table body with all the generated rows
        tableBody.innerHTML = rowsHtml.join('');

    } catch (error) {
        console.error('Error building leaderboard:', error);
        // Optionally, display an error message in the UI
        tableBody.innerHTML = '<tr><td colspan="9">Failed to load leaderboard.</td></tr>';
    }
}


const tableContainer = document.querySelector(".table-container");

function checkOverflow() {
    if (tableContainer) {
        const isOverflowing = tableContainer.scrollWidth > tableContainer.clientWidth;

        if (isOverflowing) {
        tableContainer.classList.add("is-overflowing");
        } else {
        tableContainer.classList.remove("is-overflowing");
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    populateLeaderboard();
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
});