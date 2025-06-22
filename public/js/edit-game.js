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
 * Main function to load data and populate the edit form.
 */
async function initializeEditPage() {
const pageContent = document.getElementById('page-content');
const form = document.getElementById('edit-game-form');
pageContent.insertAdjacentHTML('beforeend', html`<p class="loading">Loading game details...</p>`);

try {
    // 1. Get query parameters from the URL
    const params = new URLSearchParams(window.location.search);
    const player1_id = params.get('player1_id');
    const player2_id = params.get('player2_id');
    const rematch_id = params.get('rematch_id');

    if (!player1_id || !player2_id || rematch_id === null) {
        throw new Error("Missing required game identifiers in URL.");
    }
    
    // 2. Fetch users and the specific game data in parallel
    const gameUrl = `/api/games/${player1_id}/${player2_id}/${rematch_id}`;
    const [usersResponse, gameResponse] = await Promise.all([
        fetch('/api/users'),
        fetch(gameUrl)
    ]);

    if (!usersResponse.ok || !gameResponse.ok) throw new Error('Failed to fetch required data.');

    const users = await usersResponse.json();
    const game = await gameResponse.json();
    if (!game) throw new Error("Game not found.");

    const userMap = new Map(users.map(user => [user.id, user]));
    const player1 = userMap.get(player1_id);
    const player2 = userMap.get(player2_id);
    
    // 3. Populate form fields with the game data
    const rematchText = game.rematch_id === 0 ? 'First Match' : `Rematch ${game.rematch_id}`;
    document.getElementById('matchup-title').textContent = `${player1.name} vs. ${player2.name} (${rematchText})`;
    
    const winnerSelect = document.getElementById('winner');
    // Populate winner dropdown with only the two players in this match
    [player1, player2].forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.name} (${p.team})`;
        option.style.backgroundColor = p.team_color;
        option.style.color = getContrastingTextColor(p.team_color);
        winnerSelect.appendChild(option);
    });
    
    // Set the pre-filled values
    winnerSelect.value = game.winner_id;
    document.getElementById('balls-remaining').value = game.balls_remaining;
    document.getElementById('fouled-on-black').checked = game.fouled_on_black;
    // Format the date to YYYY-MM-DD for the input field
    document.getElementById('game-date').value = new Date(game.played_at).toISOString().split('T')[0];

    // Remove loading message and show the form
    pageContent.querySelector('.loading').remove();
    form.style.display = 'block';

} catch (error) {
    console.error("Error initializing edit page:", error);
    pageContent.innerHTML = html`<p class="error">Could not load game details. ${error.message}</p>`;
}
}

// Handle the form submission
document.getElementById('edit-game-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    // Convert form data to a plain object
    const updates = Object.fromEntries(formData.entries());
    // Convert checkbox value from "on" to a boolean
    updates.fouled_on_black = document.getElementById('fouled-on-black').checked;

    // Add IDs to updates BEFORE sending the PATCH request
    const params = new URLSearchParams(window.location.search);
    updates.player1_id = params.get('player1_id');
    updates.player2_id = params.get('player2_id');
    updates.rematch_id = params.get('rematch_id');

    try {
        const response = await fetch('/api/game', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error('Failed to save changes.');

        window.location.href = '/game-list'; 
    } catch (error) {
        console.error("Error saving game:", error);
        alert("An error occurred while saving. Please try again.");
    }
});

document.addEventListener('DOMContentLoaded', initializeEditPage);