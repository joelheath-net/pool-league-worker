export const LogGamePage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Log a Game</h1>
            <form id="log-game-form">
                <div class="form-group">
                    <label for="winner">Winner</label>
                    <select id="winner" name="winner" required>
                        <option value="" style="color: #757575" disabled selected>Select a winner...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="loser">Loser</label>
                    <select id="loser" name="loser" required>
                        <option value="" style="color: #757575" disabled selected>Select a loser...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="balls-remaining">Balls Remaining</label>
                    <input type="number" min="0" max="8" id="balls-remaining" name="balls_remaining" required placeholder="Number 0–8" />
                </div>
                <div class="form-group">
                    <label for="fouled-on-black" >Fouled on Black</label>
                    <input type="checkbox" id="fouled-on-black" name="fouled_on_black" />
                </div>
                <div class="form-group">
                    <label for="game-date">Date</label>
                    <input type="date" id="game-date" name="date" required />
                </div>
                <button type="submit">Log Game</button>
            </form>
        </div>
    );
};