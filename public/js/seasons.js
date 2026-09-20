async function populateSeasons() {
    const container = document.querySelector('#seasons-list');
    if (!container) return;

    try {
        const response = await fetch('/api/seasons');
        if (!response.ok) throw new Error('Failed to fetch seasons');
        const seasons = await response.json();

        let html = `
            <a href="/" class="season-card current-season">
                <div class="season-card-info">
                    <span class="season-card-title">Current Season</span>
                    <span class="badge-active-season">Active</span>
                </div>
                <div class="season-card-arrow">&rarr;</div>
            </a>
        `;

        if (seasons.length > 0) {
            html += seasons.map(season => `
                <a href="/archive/${season.id}" class="season-card">
                    <div class="season-card-info">
                        <span class="season-card-title">${escapeHtml(season.name)}</span>
                        <span class="badge-archived-season">Archived</span>
                    </div>
                    <div class="season-card-arrow">&rarr;</div>
                </a>
            `).join('');
        } else {
            html += `
                <div style="text-align: center; color: #888; padding: 20px 0; font-size: 0.95em;">
                    No previous seasons have been archived yet.
                </div>
            `;
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading seasons:', error);
        container.innerHTML = `
            <a href="/" class="season-card current-season">
                <div class="season-card-info">
                    <span class="season-card-title">Current Season</span>
                    <span class="badge-active-season">Active</span>
                </div>
                <div class="season-card-arrow">&rarr;</div>
            </a>
            <div class="error" style="padding: 20px 0;">Failed to load archived seasons.</div>
        `;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escapeMap[match];
    });
}

document.addEventListener('DOMContentLoaded', populateSeasons);
