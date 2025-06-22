const html = (strings, ...values) => String.raw({ raw: strings }, ...values);

/**
 * Fetches the current user profile and populates the form fields.
 */
async function loadProfile() {
    const nameInput = document.getElementById('name');
    const teamInput = document.getElementById('team');
    const colorInput = document.getElementById('team_color');
    const form = document.getElementById('profile-form');

    try {
        const response = await fetch('/api/profile');
        if (!response.ok) throw new Error('Failed to fetch profile');
        const profile = await response.json();

        // Populate the form with the fetched data
        nameInput.value = profile.name;
        teamInput.value = profile.team;
        colorInput.value = profile.team_color;

    } catch (error) {
        console.error("Error loading profile:", error);
        form.innerHTML = html`<p>Could not load your profile. Please try again later.</p>`;
    }
}

// Add a submit handler to the form
document.getElementById('profile-form').addEventListener('submit', async function(event) {
    // Prevent the default form submission behavior
    event.preventDefault(); 
    
    // Collect data from the form
    const formData = new FormData(event.target);
    const updates = Object.fromEntries(formData.entries());

    try {
        // PATCH the data to the server
        const response = await fetch('/api/profile', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error('Failed to save changes.');

        window.location.href = '/';

    } catch(error) {
        console.error('Error saving profile:', error);
        alert('An error occurred while saving. Please try again.');
    }
});

// Load the profile data when the page loads
document.addEventListener('DOMContentLoaded', loadProfile);