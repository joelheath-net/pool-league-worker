let userMap = new Map();
let winnerHome = true;

function getLocalTodayIso() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Fetches the list of all participating users and populates the home and away player dropdowns.
 */
async function populatePlayerDropdown() {
    const homeSelect = document.querySelector('#home-player');
    const awaySelect = document.querySelector('#away-player');

    try {
        const response = await fetch('/api/users?participating=true');
        if (!response.ok) throw new Error('Failed to fetch user list');
        const allUsers = await response.json();
        const users = allUsers.filter(user => user.participating);

        userMap = new Map(users.map(user => [user.id, user]));

        const createOptionsFragment = () => {
            const fragment = document.createDocumentFragment();
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.name} (${user.team})`;
                option.style.backgroundColor = user.teamColor;
                option.style.color = getContrastingTextColor(user.teamColor);
                fragment.appendChild(option);
            });
            return fragment;
        };

        homeSelect.appendChild(createOptionsFragment());
        awaySelect.appendChild(createOptionsFragment());

        const urlParams = new URLSearchParams(window.location.search);
        const homeParam = urlParams.get('homePlayerId');
        const awayParam = urlParams.get('awayPlayerId');

        if (homeParam && userMap.has(homeParam)) {
            homeSelect.value = homeParam;
        }
        if (awayParam && userMap.has(awayParam)) {
            awaySelect.value = awayParam;
        }

        updateUI();
    } catch (error) {
        console.error('Error populating player dropdowns:', error);
        homeSelect.innerHTML = html`<option value="">Error loading players</option>`;
        awaySelect.innerHTML = html`<option value="">Error loading players</option>`;
    }
}

/**
 * Updates winner button labels and active toggle state based on selected players and winnerHome.
 */
function updateUI() {
    const homeSelect = document.querySelector('#home-player');
    const awaySelect = document.querySelector('#away-player');
    const winnerHomeBtn = document.querySelector('#winner-home-btn');
    const winnerAwayBtn = document.querySelector('#winner-away-btn');
    const winnerHomeName = document.querySelector('#winner-home-name');
    const winnerAwayName = document.querySelector('#winner-away-name');

    const homeUser = userMap.get(homeSelect.value);
    const awayUser = userMap.get(awaySelect.value);

    if (winnerHomeName) winnerHomeName.textContent = homeUser ? homeUser.name : 'Player 1';
    if (winnerAwayName) winnerAwayName.textContent = awayUser ? awayUser.name : 'Player 2';

    if (winnerHome) {
        winnerHomeBtn.classList.add('active');
        winnerAwayBtn.classList.remove('active');
    } else {
        winnerAwayBtn.classList.add('active');
        winnerHomeBtn.classList.remove('active');
    }
}

function setDefaultDate() {
    const dateInput = document.querySelector('#game-date');
    const today = getLocalTodayIso();
    dateInput.value = today;
    dateInput.max = today;
}

function setupToggleButtons() {
    const winnerHomeBtn = document.querySelector('#winner-home-btn');
    const winnerAwayBtn = document.querySelector('#winner-away-btn');
    const homeSelect = document.querySelector('#home-player');
    const awaySelect = document.querySelector('#away-player');

    if (winnerHomeBtn && winnerAwayBtn) {
        winnerHomeBtn.addEventListener('click', () => {
            winnerHome = true;
            updateUI();
        });

        winnerAwayBtn.addEventListener('click', () => {
            winnerHome = false;
            updateUI();
        });
    }

    if (homeSelect) {
        homeSelect.addEventListener('change', updateUI);
    }
    if (awaySelect) {
        awaySelect.addEventListener('change', updateUI);
    }
}

document.querySelector('#log-game-form').addEventListener('submit', async function (event) {
    event.preventDefault();

    const homePlayerId = document.querySelector('#home-player').value.trim();
    const awayPlayerId = document.querySelector('#away-player').value.trim();

    if (!homePlayerId || !awayPlayerId) {
        alert('Please select both Player 1 and Player 2.');
        return;
    }

    if (homePlayerId === awayPlayerId) {
        alert('Player 1 and Player 2 cannot be the same person!');
        return;
    }

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
        homePlayerId,
        awayPlayerId,
        winnerHome,
        ballsRemaining,
        fouledOnBlack,
        playedAt
    };

    const response = await fetch('/api/participating/games', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Failed to log game. Please try again.');
        return;
    }

    window.location.href = '/';
});

document.addEventListener('DOMContentLoaded', () => {
    populatePlayerDropdown();
    setDefaultDate();
    setupToggleButtons();
});
