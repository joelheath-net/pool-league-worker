/**
 * Main function to load data and populate the edit form.
 */
async function initializeEditPage() {
    const pageContent = document.querySelector('#page-content');
    const form = document.querySelector('#edit-game-form');
    const matchupTitle = document.querySelector('#matchup-title')

    try {
        // 1. Get query parameters from the URL
        const params = new URLSearchParams(window.location.search);
        const player1Id = params.get('player1');
        const player2Id = params.get('player2');
        const rematchId = params.get('rematch');

        if (!player1Id || !player2Id || rematchId === null) {
            throw new Error('Missing required game identifiers in URL.');
        }
        
        // 2. Fetch users and the specific game data in parallel
        const gameUrl = `/api/games/${player1Id}/${player2Id}/${rematchId}`;
        const [usersResponse, gameResponse] = await Promise.all([
            fetch('/api/users'),
            fetch(gameUrl)
        ]);

        if (!usersResponse.ok || !gameResponse.ok) throw new Error('Failed to fetch required data.');

        const users = await usersResponse.json();
        const game = await gameResponse.json();
        if (!game) throw new Error('Game not found.');

        const userMap = new Map(users.map(user => [user.id, user]));
        const player1 = userMap.get(player1Id);
        const player2 = userMap.get(player2Id);
        
        // 3. Populate form fields with the game data
        const rematchText = game.rematchId === 0 ? 'First Match' : `Rematch ${game.rematchId}`;
        matchupTitle.textContent = `${player1.name} vs. ${player2.name} (${rematchText})`;

        let currentWinnerId = game.winnerId;
        const winnerP1Btn = document.querySelector('#winner-p1-btn');
        const winnerP2Btn = document.querySelector('#winner-p2-btn');
        const winnerP1Name = document.querySelector('#winner-p1-name');
        const winnerP2Name = document.querySelector('#winner-p2-name');

        if (winnerP1Name) winnerP1Name.textContent = player1.name;
        if (winnerP2Name) winnerP2Name.textContent = player2.name;

        const updateWinnerToggle = (selectedId) => {
            currentWinnerId = selectedId;
            if (selectedId === player1.id) {
                winnerP1Btn.classList.add('active');
                winnerP2Btn.classList.remove('active');
            } else {
                winnerP2Btn.classList.add('active');
                winnerP1Btn.classList.remove('active');
            }
        };

        updateWinnerToggle(game.winnerId);

        winnerP1Btn.addEventListener('click', () => updateWinnerToggle(player1.id));
        winnerP2Btn.addEventListener('click', () => updateWinnerToggle(player2.id));
        
        // Set the pre-filled values
        document.querySelector('#balls-remaining').value = game.ballsRemaining;
        document.querySelector('#fouled-on-black').checked = game.fouledOnBlack;
        // Format the date to YYYY-MM-DD for the input field
        document.querySelector('#game-date').value = new Date(game.playedAt).toISOString().split('T')[0];

        form.style.display = 'block';

    } catch (error) {
        console.error('Error initializing edit page:', error);
        matchupTitle.innerHTML = 'Could not load game details.';
        pageContent.insertAdjacentHTML('beforeend', html`<p class="error">${error.message}</p>`);
        return;
    }

    // Handle the form submission
    document.querySelector('#edit-game-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    // Convert form data to a plain object
    const updates = Object.fromEntries(formData.entries());
    updates.winnerId = currentWinnerId;
    // Convert checkbox value from "on" to a boolean
    updates.fouledOnBlack = document.querySelector('#fouled-on-black').checked;
    updates.ballsRemaining = parseInt(updates.ballsRemaining, 10);

    const params = new URLSearchParams(window.location.search);
    updates.player1Id = params.get('player1');
    updates.player2Id = params.get('player2');
    updates.rematchId = parseInt(params.get('rematch'), 10);

    try {
        const response = await fetch('/api/game', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update game.');
        }

        window.location.href = '/game-list'; 
    } catch (error) {
        console.error('Error saving game:', error);
        alert('An error occurred while saving. Please try again. \n' + error.message);
    }
});
}

document.addEventListener('DOMContentLoaded', initializeEditPage);