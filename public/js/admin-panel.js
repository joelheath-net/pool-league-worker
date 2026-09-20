async function populatePlayerDropdown() {
    const playerSelect = document.querySelector('#player');

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
            option.style.backgroundColor = user.teamColor;
            option.style.color = getContrastingTextColor(user.teamColor);
            optionsFragment.appendChild(option);
        });

        // Append the options to both select elements by cloning the fragment
        playerSelect.appendChild(optionsFragment.cloneNode(true));

    } catch (error) {
        console.error("Error populating player dropdown:", error);
        playerSelect.innerHTML = html`<option value="">Error loading players</option>`;
    }
}

async function populateParticipationTable() {
    const tableBody = document.querySelector('#participation-body');
    if (!tableBody) return;

    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Failed to fetch user list');
        const users = await response.json();

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;"><div class="table-cell">No users registered yet.</div></td></tr>';
            return;
        }

        const rowsHtml = users.map(user => {
            const color = user.teamColor || '#ffffff';
            const textColor = getContrastingTextColor(color);
            return eta.render(html`
                <tr>
                    <td style="background-color: {{= it.color }};"><div class="table-cell" style="color: {{= it.textColor }}">{{= it.name }}</div></td>
                    <td style="background-color: {{= it.color }};"><div class="table-cell" style="color: {{= it.textColor }}">{{= it.team }}</div></td>
                    <td style="text-align: center;">
                        <div class="table-cell">
                            <input type="checkbox" class="user-participating-checkbox" data-user-id="{{= it.id }}" {{= it.participating ? 'checked' : '' }} />
                        </div>
                    </td>
                </tr>
            `, { ...user, color, textColor });
        }).join('');

        tableBody.innerHTML = rowsHtml;
    } catch (error) {
        console.error('Error populating participation table:', error);
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;"><div class="table-cell">Error loading players.</div></td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    populatePlayerDropdown();
    populateParticipationTable();
    
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
            const tsvData = document.querySelector('#import-data-textarea').value;
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
                    document.querySelector('#import-data-textarea').value = ''; // Clear the text area
                } catch (error) {
                    console.error('Error importing games:', error);
                    alert(`An error occurred while importing games: ${error.message}`);
                }
            }
        });
    }

    const archiveSeasonButton = document.querySelector('#archive-season-button');
    if (archiveSeasonButton) {
        archiveSeasonButton.addEventListener('click', async () => {
            const seasonName = document.querySelector('#season-name').value;
            if (!seasonName.trim()) {
                return alert('Please enter a name for the season before archiving.');
            }

            if (confirm(`Are you sure you want to archive the current season as "${seasonName}"? This will save the final leaderboard and delete all current game records. This action cannot be undone.`)) {
                try {
                    const response = await fetch('/admin/archive-season', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ seasonName })
                    });
                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Failed to archive the season');
                    }

                    alert(`Season archived successfully with ID: ${result.newSeasonId}. The leaderboard is now cleared for the new season.`);
                    window.location.href = `/archive/${result.newSeasonId}`;
                } catch (error) {
                    console.error('Error archiving season:', error);
                    alert(`An error occurred while archiving the season: ${error.message}`);
                }
            }
        });
    }

    const selectAllBtn = document.querySelector('#select-all-participation');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.user-participating-checkbox').forEach(cb => cb.checked = true);
        });
    }

    const deselectAllBtn = document.querySelector('#deselect-all-participation');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.user-participating-checkbox').forEach(cb => cb.checked = false);
        });
    }

    const saveParticipationBtn = document.querySelector('#save-participation-button');
    if (saveParticipationBtn) {
        saveParticipationBtn.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.user-participating-checkbox');
            const participations = Array.from(checkboxes).map(cb => ({
                id: cb.dataset.userId,
                participating: cb.checked
            }));

            saveParticipationBtn.disabled = true;
            saveParticipationBtn.textContent = 'Saving...';

            try {
                const response = await fetch('/admin/update-participation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ participations })
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Failed to save participation changes');
                }

                alert('Player participation updated successfully.');
            } catch (error) {
                console.error('Error saving participation changes:', error);
                alert(`An error occurred while saving: ${error.message}`);
            } finally {
                saveParticipationBtn.disabled = false;
                saveParticipationBtn.textContent = 'Save Participation Changes';
            }
        });
    }
});