let userMap = new Map();
let currentWinnerPlayer = 1;

/**
 * Fetches the list of all participating users and populates player1 and player2 dropdowns.
 */
async function populatePlayerDropdown() {
    const player1Select = document.querySelector('#player1');
    const player2Select = document.querySelector('#player2');

    try {
        const response = await fetch('/api/users?participating=true');
        if (!response.ok) throw new Error('Failed to fetch user list');
        const allUsers = await response.json();
        const users = allUsers.filter(user => user.participating);

        userMap = new Map(users.map(user => [user.id, user]));

        // Create options for dropdowns
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

        player1Select.appendChild(createOptionsFragment());
        player2Select.appendChild(createOptionsFragment());

        // Check for URL query params: ?player1=...&player2=...
        const urlParams = new URLSearchParams(window.location.search);
        const player1Param = urlParams.get('player1');
        const player2Param = urlParams.get('player2');

        if (player1Param && userMap.has(player1Param)) {
            player1Select.value = player1Param;
        }
        if (player2Param && userMap.has(player2Param)) {
            player2Select.value = player2Param;
        }

        updateUI();

    } catch (error) {
        console.error("Error populating player dropdowns:", error);
        player1Select.innerHTML = html`<option value="">Error loading players</option>`;
        player2Select.innerHTML = html`<option value="">Error loading players</option>`;
    }
}

/**
 * Updates winner button labels and loser name display based on currently selected players and winner.
 */
function updateUI() {
    const player1Select = document.querySelector('#player1');
    const player2Select = document.querySelector('#player2');
    const winnerBtn1 = document.querySelector('#winner-p1-btn');
    const winnerBtn2 = document.querySelector('#winner-p2-btn');
    const winnerP1Name = document.querySelector('#winner-p1-name');
    const winnerP2Name = document.querySelector('#winner-p2-name');
    const loserNameText = document.querySelector('#loser-name-text');

    const u1 = userMap.get(player1Select.value);
    const u2 = userMap.get(player2Select.value);

    const p1DisplayName = u1 ? u1.name : 'Player 1';
    const p2DisplayName = u2 ? u2.name : 'Player 2';

    if (winnerP1Name) winnerP1Name.textContent = p1DisplayName;
    if (winnerP2Name) winnerP2Name.textContent = p2DisplayName;

    if (currentWinnerPlayer === 1) {
        winnerBtn1.classList.add('active');
        winnerBtn2.classList.remove('active');
    } else {
        winnerBtn2.classList.add('active');
        winnerBtn1.classList.remove('active');
    }
}

// Set the date input to today by default
function setDefaultDate() {
    const dateInput = document.querySelector('#game-date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

// Setup winner toggle button listeners
function setupToggleButtons() {
    const winnerBtn1 = document.querySelector('#winner-p1-btn');
    const winnerBtn2 = document.querySelector('#winner-p2-btn');
    const player1Select = document.querySelector('#player1');
    const player2Select = document.querySelector('#player2');

    if (winnerBtn1 && winnerBtn2) {
        winnerBtn1.addEventListener('click', () => {
            currentWinnerPlayer = 1;
            updateUI();
        });

        winnerBtn2.addEventListener('click', () => {
            currentWinnerPlayer = 2;
            updateUI();
        });
    }

    if (player1Select) {
        player1Select.addEventListener('change', updateUI);
    }
    if (player2Select) {
        player2Select.addEventListener('change', updateUI);
    }
}

// Add submit handler to the form
document.querySelector('#log-game-form').addEventListener('submit', async function(event) {
    event.preventDefault(); 

    const p1Id = document.querySelector('#player1').value;
    const p2Id = document.querySelector('#player2').value;

    if (!p1Id || !p2Id) {
        alert('Please select both Player 1 and Player 2.');
        return;
    }

    if (p1Id === p2Id) {
        alert('Player 1 and Player 2 cannot be the same person!');
        return;
    }

    const winner = currentWinnerPlayer === 1 ? p1Id : p2Id;
    const loser = currentWinnerPlayer === 1 ? p2Id : p1Id;

    const ballsRemainingInput = document.querySelector('#balls-remaining').value;
    const ballsRemaining = parseInt(ballsRemainingInput, 10);
    const fouledOnBlack = document.querySelector('#fouled-on-black').checked;
    const date = document.querySelector('#game-date').value;

    const payload = {
        winner,
        loser,
        ballsRemaining,
        fouledOnBlack,
        date
    };

    console.log("Game Logged", payload);

    const response = await fetch('/api/log-game', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Failed to log game. Please try again.');
        return;
    }

    // Redirect to home/leaderboard
    window.location.href = '/';
});

// Run the setup functions after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    populatePlayerDropdown();
    setDefaultDate();
    setupToggleButtons();
});