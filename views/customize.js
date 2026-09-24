export const CustomizePage = () => {
    return (
        <div class="container centre-container">
             <h1 class="centre-title">Customise Profile</h1>

            <form id="profile-form">
                <div class="form-group">
                    <label for="name">Display Name</label>
                    <input type="text" id="name" name="name" required placeholder="Enter your name" />
                </div>

                <div class="form-group">
                    <label for="team">Team Name</label>
                    <input type="text" id="team" name="team" required placeholder="Enter your team's name" />
                </div>
                
                <div class="form-group">
                    <label for="team-color">Team Colour</label>
                    <input type="color" id="team-color" name="teamColor" required />
                </div>

                <button type="submit">Save Changes</button>
            </form>

            <div id="pwa-notifications-card" class="pwa-notifications-card">
                <div class="notifications-card-header">
                    <h2>Push Notifications</h2>
                    <span id="push-status-badge" class="push-status-badge badge-checking">Checking...</span>
                </div>
                <p class="notifications-card-desc">
                    Receive instant alerts on your device whenever a your leaderboard ranking changes.
                </p>
                <div class="notifications-card-action">
                    <button type="button" id="push-toggle-btn" class="push-btn push-btn-primary" disabled>
                        Enable Notifications
                    </button>
                    <button type="button" id="push-test-btn" class="push-btn push-btn-secondary" style="display: none;">
                        Send Test Alert
                    </button>
                </div>
                <div id="push-feedback" class="push-feedback" style="display: none;"></div>
            </div>
        </div>
    );
};