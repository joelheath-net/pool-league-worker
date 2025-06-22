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

async function populatePlayerDropdowns() {
    const playerSelect = document.getElementById('player');

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
        playerSelect.appendChild(optionsFragment.cloneNode(true));

    } catch (error) {
        console.error("Error populating player dropdown:", error);
        playerSelect.innerHTML = html`<option value="">Error loading players</option>`;
    }
}


const resetDbButton = document.querySelector('#reset-db-button');
if (resetDbButton) {
    resetDbButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to reset the database? This action cannot be undone.')) {
            try {
                const response = await fetch('/admin/reset-db', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to reset the database');
                }

                alert('Database has been reset successfully.');
                window.location.reload();
            } catch (error) {
                console.error('Error resetting database:', error);
                alert('An error occurred while resetting the database. Please try again later.');
            }
        }
    });
}

const deletePlayerButton = document.querySelector('#delete-player-button');
if (deletePlayerButton) {
    deletePlayerButton.addEventListener('click', async () => {
        const playerOption = document.querySelector('#player').selectedOptions[0];
        const name = playerOption.textContent;
        const id = playerOption.value;

        if (!name)
            return alert('Please select a player to delete.');

        if (confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
            try {
                const response = await fetch(`/admin/delete-user/${id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error(`Failed to delete ${name} the database`);
                }

                alert(`Player ${name} has been deleted successfully.`);
                window.location.reload();
            } catch (error) {
                console.error(`Error deleting player ${name}:`, error);
                alert(`An error occurred while deleting ${name}. Please try again later`);
            }
        }
    });
}

//dom
document.addEventListener('DOMContentLoaded', () => {
    populatePlayerDropdowns();
});