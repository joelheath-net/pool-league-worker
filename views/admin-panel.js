export const AdminPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Admin Panel</h1>

            <div class="form-group" style="background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 25px;">
                <h2 style="margin-top: 0;">Player Participation</h2>
                <p style="color: #666; font-size: 0.9em; margin-bottom: 12px;">
                    Select which players are participating in the current season. Non-participating players will not appear on the leaderboard or in game logging dropdowns, and any games they play will be treated as friendlies.
                </p>
                <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                    <button type="button" id="select-all-participation" class="button" style="width: auto; padding: 6px 12px; font-size: 0.85em; background-color: #6c757d; color: white;">Select All</button>
                    <button type="button" id="deselect-all-participation" class="button" style="width: auto; padding: 6px 12px; font-size: 0.85em; background-color: #6c757d; color: white;">Deselect All</button>
                </div>
                <div class="table-container" style="max-height: 400px; overflow-y: auto; margin: 10px 0;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th><div class="table-cell">Player</div></th>
                                <th><div class="table-cell">Team</div></th>
                                <th style="text-align: center;"><div class="table-cell">Participating</div></th>
                            </tr>
                        </thead>
                        <tbody id="participation-body">
                            <tr>
                                <td colspan="3" style="text-align: center;"><div class="table-cell">Loading players...</div></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <button id="save-participation-button" class="button" style="margin-top: 10px; background-color: #28a745; color: white;">Save Participation Changes</button>
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
            <div class="form-group">
                <label for="import-data-textarea">Paste Google Sheets Data</label>
                <textarea id="import-data-textarea" class="input" rows="10" placeholder="TSV with headers: Date, Winner ID, Loser ID, Fouled on black, Balls Remaining, Rematch Round"></textarea>
                <button id="import-games-button" class="button">Import</button>
            </div>
        </div>
    );
};