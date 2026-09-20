export const AdminPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Admin Panel</h1>

            <div class="form-group" style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 25px;">
                <h2 style="margin-top: 0;">Players</h2>
                <p style="color: #666; font-size: 0.9em; margin-bottom: 12px;">
                    Edit player display names, team names, team colours, and season participation. Click Save Changes at the bottom to apply edits.
                </p>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                    <button type="button" id="select-all-participation" class="button" style="width: auto; padding: 6px 12px; font-size: 0.85em; background-color: #6c757d; color: white;">Select All Participating</button>
                    <button type="button" id="deselect-all-participation" class="button" style="width: auto; padding: 6px 12px; font-size: 0.85em; background-color: #6c757d; color: white;">Deselect All Participating</button>
                </div>
                <div class="table-container" style="max-height: 480px; overflow-y: auto; margin: 10px 0;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th><div class="table-cell">Player Name</div></th>
                                <th><div class="table-cell">Team Name</div></th>
                                <th style="text-align: center;"><div class="table-cell">Colour</div></th>
                                <th style="text-align: center;"><div class="table-cell">Participating</div></th>
                            </tr>
                        </thead>
                        <tbody id="players-body">
                            <tr>
                                <td colspan="4" style="text-align: center;"><div class="table-cell">Loading players...</div></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <button id="save-players-button" class="button" style="margin-top: 10px; background-color: #28a745; color: white;">Save Changes</button>
            </div>

            <div class="form-group" style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 25px;">
                <h2 style="margin-top: 0;">Email Whitelist</h2>
                <p style="color: #666; font-size: 0.9em; margin-bottom: 12px;">
                    Only Google accounts with email addresses in this whitelist can sign in.
                </p>
                <div id="whitelist-items" class="whitelist-list" style="margin-bottom: 15px;">
                    <div style="color: #888; padding: 10px 0; text-align: center;">Loading whitelist...</div>
                </div>
                <form id="add-whitelist-form" style="display: flex; gap: 10px; padding: 0; box-shadow: none; max-width: none; background: transparent;">
                    <input type="email" id="whitelist-email-input" class="input" placeholder="Enter email to whitelist..." required style="flex-grow: 1;" />
                    <button type="submit" class="button" style="width: auto; padding: 10px 20px; white-space: nowrap; background-color: #007bff; color: white;">Add Email</button>
                </form>
            </div>

            <div class="form-group">
                <label for="season-name">Archive Season</label>
                <input type="text" id="season-name" class="input" placeholder="Enter season name (e.g. 2024/25)" />
                <button id="archive-season-button" class="button" style="margin-top: 4px;">Archive</button>
            </div>
            <div class="form-group">
                <button id="reset-db-button" class="button">Delete All Game Records</button>
            </div>
            <div class="form-group">
                <label for="player">Delete player</label>
                <select id="player" name="player" required>
                    <option value="" style="color: #757575" disabled selected>Select a player...</option>
                </select>
                <button id="delete-player-button" class="button" style="margin-top: 4px;">Delete Player</button>
            </div>
        </div>
    );
};