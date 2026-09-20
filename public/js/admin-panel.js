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

async function populatePlayersTable() {
    const tableBody = document.querySelector('#players-body');
    if (!tableBody) return;

    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Failed to fetch user list');
        const users = await response.json();

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;"><div class="table-cell">No users registered yet.</div></td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => {
            const color = user.teamColor || '#ffffff';
            return `
                <tr data-user-id="${escapeHtml(user.id)}">
                    <td>
                        <div class="table-cell">
                            <input type="text" class="player-name-input player-text-input" value="${escapeHtml(user.name)}" required placeholder="Player name" />
                        </div>
                    </td>
                    <td>
                        <div class="table-cell">
                            <input type="text" class="player-team-input player-text-input" value="${escapeHtml(user.team)}" required placeholder="Team name" />
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <div class="table-cell">
                            <input type="color" class="player-color-input" value="${escapeHtml(color)}" title="Team colour" />
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <div class="table-cell">
                            <input type="checkbox" class="player-participating-checkbox" ${user.participating ? 'checked' : ''} />
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error populating players table:', error);
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;"><div class="table-cell">Error loading players.</div></td></tr>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escapeMap[match];
    });
}

async function populateWhitelist() {
    const listContainer = document.querySelector('#whitelist-items');
    if (!listContainer) return;

    try {
        const response = await fetch('/admin/whitelist');
        if (!response.ok) throw new Error('Failed to fetch whitelist');
        const whitelist = await response.json();

        if (whitelist.length === 0) {
            listContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">No emails whitelisted yet.</div>';
            return;
        }

        listContainer.innerHTML = whitelist.map(item => `
            <div class="whitelist-item">
                <span class="whitelist-email">${escapeHtml(item.email)}</span>
                <button type="button" class="whitelist-remove-button" data-email="${escapeHtml(item.email)}" title="Remove ${escapeHtml(item.email)}">&times;</button>
            </div>
        `).join('');

        // Wire up remove buttons
        listContainer.querySelectorAll('.whitelist-remove-button').forEach(button => {
            button.addEventListener('click', async () => {
                const email = button.dataset.email;
                if (!confirm(`Are you sure you want to remove ${email} from the whitelist?`)) {
                    return;
                }

                try {
                    const deleteResponse = await fetch(`/admin/whitelist/${encodeURIComponent(email)}`, {
                        method: 'DELETE'
                    });

                    if (!deleteResponse.ok) {
                        const err = await deleteResponse.json().catch(() => ({}));
                        throw new Error(err.error || 'Failed to remove email');
                    }

                    await populateWhitelist();
                } catch (error) {
                    console.error('Error removing email:', error);
                    alert(`An error occurred: ${error.message}`);
                }
            });
        });
    } catch (error) {
        console.error('Error loading whitelist:', error);
        listContainer.innerHTML = '<div class="error" style="padding: 10px;">Error loading whitelist.</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    populatePlayerDropdown();
    populatePlayersTable();
    populateWhitelist();
    
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

    const addWhitelistForm = document.querySelector('#add-whitelist-form');
    if (addWhitelistForm) {
        addWhitelistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.querySelector('#whitelist-email-input');
            const email = input.value.trim();
            if (!email) return;

            try {
                const response = await fetch('/admin/whitelist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Failed to add email');
                }

                input.value = '';
                await populateWhitelist();
            } catch (error) {
                console.error('Error adding email:', error);
                alert(`An error occurred: ${error.message}`);
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
            document.querySelectorAll('.player-participating-checkbox').forEach(cb => cb.checked = true);
        });
    }

    const deselectAllBtn = document.querySelector('#deselect-all-participation');
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('.player-participating-checkbox').forEach(cb => cb.checked = false);
        });
    }

    const savePlayersBtn = document.querySelector('#save-players-button') || document.querySelector('#save-participation-button');
    if (savePlayersBtn) {
        savePlayersBtn.addEventListener('click', async () => {
            const rows = document.querySelectorAll('#players-body tr[data-user-id]');
            const players = [];

            for (const row of rows) {
                const id = row.dataset.userId;
                const nameInput = row.querySelector('.player-name-input');
                const teamInput = row.querySelector('.player-team-input');
                const colorInput = row.querySelector('.player-color-input');
                const checkbox = row.querySelector('.player-participating-checkbox');

                const name = nameInput ? nameInput.value.trim() : '';
                const team = teamInput ? teamInput.value.trim() : '';
                const teamColor = colorInput ? colorInput.value : '#ffffff';
                const participating = checkbox ? checkbox.checked : true;

                if (!name) {
                    alert('All players must have a name.');
                    if (nameInput) nameInput.focus();
                    return;
                }

                if (!team) {
                    alert(`Please enter a team name for "${name}".`);
                    if (teamInput) teamInput.focus();
                    return;
                }

                players.push({ id, name, team, teamColor, participating });
            }

            savePlayersBtn.disabled = true;
            savePlayersBtn.textContent = 'Saving...';

            try {
                const response = await fetch('/admin/update-players', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ players })
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'Failed to save player changes');
                }

                alert('Player changes saved successfully.');

                // Refresh the "Delete player" dropdown so names/teams match
                const playerSelect = document.querySelector('#player');
                if (playerSelect) {
                    playerSelect.innerHTML = '<option value="" style="color: #757575" disabled selected>Select a player...</option>';
                    populatePlayerDropdown();
                }
            } catch (error) {
                console.error('Error saving player changes:', error);
                alert(`An error occurred while saving: ${error.message}`);
            } finally {
                savePlayersBtn.disabled = false;
                savePlayersBtn.textContent = 'Save Changes';
            }
        });
    }
});