async function populatePlayerDropdown() {
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

document.addEventListener('DOMContentLoaded', () => {
    populatePlayerDropdown();
    
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

            if (!id)
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
                        throw new Error(`Failed to delete ${name} from the database`);
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

    const importGamesButton = document.querySelector('#import-games-button');
    if (importGamesButton) {
        importGamesButton.addEventListener('click', async () => {
            const tsvData = document.getElementById('import-data-textarea').value;
            if (!tsvData.trim()) {
                return alert('Please paste data into the text box.');
            }

            if (confirm('Are you sure you want to import these games? This will create new game revisions.')) {
                try {
                    const response = await fetch('/admin/import-games', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'text/plain',
                        },
                        body: tsvData,
                    });
                    
                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Failed to import games.');
                    }

                    alert(`Successfully imported ${result.importedCount} games.`);
                    document.getElementById('import-data-textarea').value = ''; // Clear the text area
                } catch (error) {
                    console.error('Error importing games:', error);
                    alert(`An error occurred while importing games: ${error.message}`);
                }
            }
        });
    }
});