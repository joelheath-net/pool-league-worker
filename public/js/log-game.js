/**
 * Fetches the list of all users and populates the dropdown selectors.
 */
async function populatePlayerDropdown() {
    const winnerSelect = document.getElementById('winner');
    const loserSelect = document.getElementById('loser');

    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Failed to fetch user list');
        const users = await response.json();


        // Create a document fragment to build the options efficiently
        const optionsFragment = document.createDocumentFragment();

        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (${user.team})`;
            option.style.backgroundColor = user.team_color;
            option.style.color = getContrastingTextColor(user.team_color);
            optionsFragment.appendChild(option);
        });

        // Append the options to both select elements by cloning the fragment
        winnerSelect.appendChild(optionsFragment.cloneNode(true));
        loserSelect.appendChild(optionsFragment.cloneNode(true));

    } catch (error) {
        console.error("Error populating player dropdowns:", error);
        winnerSelect.innerHTML = html`<option value="">Error loading players</option>`;
        loserSelect.innerHTML = html`<option value="">Error loading players</option>`;
    }
}

// Set the date input to today by default
function setDefaultDate() {
    const dateInput = document.getElementById('game-date');
    // Format to YYYY-MM-DD for the date input value
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

// Add a submit handler to the form
document.getElementById('log-game-form').addEventListener('submit', async function(event) {
    // Prevent the form from actually submitting to a server
    event.preventDefault(); 
    
    const winner = document.getElementById('winner').value;
    const loser = document.getElementById('loser').value;

    if (winner === loser) {
        alert('Winner and Loser cannot be the same person!');
        return; // Stop the submission
    }

    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    
    // The checkbox value will be 'on' if checked, or null if not.
    // We can convert this to a proper boolean.
    data.fouled_on_black = data.fouled_on_black === 'on';

    console.log("Game Logged", data);

    const response = await fetch('/api/log-game', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) {
        alert('Failed to log game. Please try again.');
        return;
    }
    // redirect to /
    window.location.href = '/';
});

// Run the setup functions after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    populatePlayerDropdown();
    setDefaultDate();
});