export const EditGamePage = () => {
    return (
        <div id="page-content" class="container centre-container">
            <h1 class="centre-title">Edit Game</h1>
            <h2 id="matchup-title" class="centre-title"></h2>

            <form id="edit-game-form" style="display: none;">
                <div class="form-group">
                    <label for="winner">Winner</label>
                    <select id="winner" name="winner_id" required>
                        
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="balls-remaining">Balls Remaining</label>
                    <input type="number" min="0" max="8" id="balls-remaining" name="balls_remaining" required placeholder="Number 0–8" />
                </div>

                <div class="form-group">
                    <label for="fouled-on-black">Fouled on Black</label>
                    <input type="checkbox" id="fouled-on-black" name="fouled_on_black" />
                </div>

                <div class="form-group">
                    <label for="game-date">Date</label>
                    <input type="date" id="game-date" name="played_at" required />
                </div>

                <button type="submit">Save Changes</button>
            </form>
        </div>
    );
};