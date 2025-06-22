export const AdminPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Admin Panel</h1>
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