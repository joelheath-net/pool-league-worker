export const LogGamePage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Log a Game</h1>
            <form id="log-game-form">
                <div class="match-players-row">
                    <div class="form-group player-select-col">
                        <label for="home-player">Player 1</label>
                        <select id="home-player" name="homePlayerId" required>
                            <option value="" style="color: #757575" disabled selected>Select Player 1...</option>
                        </select>
                    </div>
                    <div class="match-vs-badge">VS</div>
                    <div class="form-group player-select-col">
                        <label for="away-player">Player 2</label>
                        <select id="away-player" name="awayPlayerId" required>
                            <option value="" style="color: #757575" disabled selected>Select Player 2...</option>
                        </select>
                    </div>
                </div>

                <div class="form-group winner-selection-section">
                    <label>Winner</label>
                    <div class="winner-toggle-container">
                        <button type="button" id="winner-home-btn" class="winner-toggle-btn active" data-winner-home="true">
                            <span class="winner-status-icon">🏆</span>
                            <span id="winner-home-name" class="winner-player-name">Player 1</span>
                        </button>
                        <button type="button" id="winner-away-btn" class="winner-toggle-btn" data-winner-home="false">
                            <span class="winner-status-icon">🏆</span>
                            <span id="winner-away-name" class="winner-player-name">Player 2</span>
                        </button>
                    </div>
                </div>

                <div class="loser-details-card">
                    <div class="loser-details-title">Loser Performance</div>
                    <div class="form-group">
                        <label for="balls-remaining">Balls Remaining</label>
                        <input type="number" min="0" max="8" step="1" id="balls-remaining" name="ballsRemaining" required placeholder="Number 0–8" />
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
                <button type="submit">Log Game</button>
            </form>
        </div>
    );
};
