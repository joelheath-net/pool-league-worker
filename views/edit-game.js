export const EditGamePage = () => {
    return (
        <div id="page-content" class="container centre-container">
            <h1 class="centre-title">Edit Game</h1>
            <h2 id="matchup-title" class="centre-title">Loading match details...</h2>

            <form id="edit-game-form" style="display: none;">
                <div class="form-group winner-selection-section">
                    <label>Winner</label>
                    <div class="winner-toggle-container">
                        <button type="button" id="winner-p1-btn" class="winner-toggle-btn active" data-player="1">
                            <span class="winner-status-icon">🏆</span>
                            <span id="winner-p1-name" class="winner-player-name">Player 1</span>
                        </button>
                        <button type="button" id="winner-p2-btn" class="winner-toggle-btn" data-player="2">
                            <span class="winner-status-icon">🏆</span>
                            <span id="winner-p2-name" class="winner-player-name">Player 2</span>
                        </button>
                    </div>
                </div>

                <div class="loser-details-card">
                    <div class="loser-details-title">Loser Performance</div>
                    <div class="form-group">
                        <label for="balls-remaining">Balls Remaining</label>
                        <input type="number" min="0" max="8" id="balls-remaining" name="ballsRemaining" required placeholder="Number 0–8" />
                    </div>
                    <div class="form-group form-group-checkbox">
                        <label for="fouled-on-black" style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="fouled-on-black" name="fouledOnBlack" style="width: 20px; height: 20px; margin: 0;" />
                            <span>Fouled on Black</span>
                        </label>
                    </div>
                </div>

                <div class="form-group" style="margin-top: 15px;">
                    <label for="game-date">Date</label>
                    <input type="date" id="game-date" name="playedAt" required />
                </div>

                <button type="submit">Save Changes</button>
            </form>
        </div>
    );
};