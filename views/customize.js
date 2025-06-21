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
                    <label for="team_color">Team Colour</label>
                    <input type="color" id="team_color" name="team_color" required />
                </div>

                <button type="submit">Save Changes</button>
            </form>
        </div>
    );
};