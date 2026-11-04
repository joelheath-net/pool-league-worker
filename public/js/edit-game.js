function getLocalTodayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Loads the game by its unique `id` query parameter and populates the edit form.
 */
async function initializeEditPage() {
    const pageContent = document.querySelector('#page-content');
    const form = document.querySelector('#edit-game-form');
    const matchupTitle = document.querySelector('#matchup-title');

    let loadedGame = null;
    let homePlayerName = 'Unknown Player';
    let awayPlayerName = 'Unknown Player';
    let rematchLabel = 'First Match';
    let winnerHome = true;

    try {
        const params = new URLSearchParams(window.location.search);
        const gameIdParam = params.get('id');

        if (!gameIdParam || !/^[1-9]\d*$/.test(gameIdParam)) {
            throw new Error('Missing or invalid game ID in URL.');
        }

        const gameUrl = `/api/participating/games/${encodeURIComponent(gameIdParam)}`;
        const [usersResponse, gameResponse] = await Promise.all([
            fetch('/api/users'),
            fetch(gameUrl)
        ]);

        if (!usersResponse.ok || !gameResponse.ok) {
            const errData = !gameResponse.ok ? await gameResponse.json().catch(() => ({})) : {};
            throw new Error(errData.message || 'Failed to fetch required game data.');
        }

        const users = await usersResponse.json();
        const game = await gameResponse.json();
        if (!game) throw new Error('Game not found.');

        loadedGame = game;

        const userMap = new Map(users.map(user => [user.id, user]));
        const homePlayer = userMap.get(game.homePlayerId) || { id: game.homePlayerId, name: 'Unknown Player' };
        const awayPlayer = userMap.get(game.awayPlayerId) || { id: game.awayPlayerId, name: 'Unknown Player' };

        const rematchText = game.rematchId === 0 ? 'First Match' : `Rematch ${game.rematchId}`;
        homePlayerName = homePlayer.name;
        awayPlayerName = awayPlayer.name;
        rematchLabel = rematchText;
        matchupTitle.textContent = `${homePlayer.name} vs. ${awayPlayer.name} (${rematchText})`;

        const winnerHomeBtn = document.querySelector('#winner-home-btn');
        const winnerAwayBtn = document.querySelector('#winner-away-btn');
        const winnerHomeName = document.querySelector('#winner-home-name');
        const winnerAwayName = document.querySelector('#winner-away-name');

        if (winnerHomeName) winnerHomeName.textContent = homePlayer.name;
        if (winnerAwayName) winnerAwayName.textContent = awayPlayer.name;

        const updateWinnerToggle = (isHomeWinner) => {
            winnerHome = Boolean(isHomeWinner);
            if (winnerHome) {
                winnerHomeBtn.classList.add('active');
                winnerAwayBtn.classList.remove('active');
            } else {
                winnerAwayBtn.classList.add('active');
                winnerHomeBtn.classList.remove('active');
            }
        };

        updateWinnerToggle(game.winnerHome);

        winnerHomeBtn.addEventListener('click', () => updateWinnerToggle(true));
        winnerAwayBtn.addEventListener('click', () => updateWinnerToggle(false));

        document.querySelector('#balls-remaining').value = game.ballsRemaining;
        document.querySelector('#fouled-on-black').checked = Boolean(game.fouledOnBlack);

        const dateInput = document.querySelector('#game-date');
        dateInput.max = getLocalTodayIso();
        dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(game.playedAt)
            ? game.playedAt
            : new Date(game.playedAt).toISOString().split('T')[0];

        form.style.display = 'block';
    } catch (error) {
        console.error('Error initializing edit page:', error);
        matchupTitle.textContent = 'Could not load game details.';
        pageContent.insertAdjacentHTML('beforeend', html`<p class="error">${escapeHTML(error.message)}</p>`);
        return;
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const ballsRemainingRaw = document.querySelector('#balls-remaining').value.trim();
        const ballsRemaining = Number(ballsRemainingRaw);
        if (ballsRemainingRaw === '' || !Number.isInteger(ballsRemaining) || ballsRemaining < 0 || ballsRemaining > 8) {
            alert('Balls remaining must be a whole number between 0 and 8.');
            return;
        }

        const fouledOnBlack = document.querySelector('#fouled-on-black').checked;
        const playedAt = document.querySelector('#game-date').value.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) {
            alert('Please enter a valid date.');
            return;
        }

        const payload = {
            homePlayerId: loadedGame.homePlayerId,
            awayPlayerId: loadedGame.awayPlayerId,
            winnerHome,
            ballsRemaining,
            fouledOnBlack,
            playedAt
        };

        try {
            const response = await fetch(`/api/participating/games/${encodeURIComponent(loadedGame.gameId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update game.');
            }

            window.location.href = '/game-list';
        } catch (error) {
            console.error('Error saving game:', error);
            alert('An error occurred while saving. Please try again.\n' + error.message);
        }
    });

    const deleteBtn = document.querySelector('#delete-game-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function () {
            const confirmed = confirm(
                `Are you sure you want to delete this game (${homePlayerName} vs. ${awayPlayerName}, ${rematchLabel})?`
            );
            if (!confirmed) return;

            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';

            try {
                const response = await fetch(`/api/participating/games/${encodeURIComponent(loadedGame.gameId)}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to delete game.');
                }

                window.location.href = '/game-list';
            } catch (error) {
                console.error('Error deleting game:', error);
                alert('An error occurred while deleting. Please try again.\n' + error.message);
                deleteBtn.disabled = false;
                deleteBtn.textContent = 'Delete Game';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initializeEditPage);
