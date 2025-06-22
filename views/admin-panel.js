export const AdminPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Admin Panel</h1>
            <div class="form-group">
                <button id="reset-db-button" class="button">Delete All Game Records</button>
            </div>
            <div class="form-group">
                <select id="player" name="player" required>
                    <option value="" style="color: #757575" disabled selected>Select a player...</option>
                </select>
                <button id="delete-player-button" class="button">Delete Player</button>
            </div>
        </div>
    );
};