/**
 * Fetches all revisions and users, then populates the audit log.
 */
async function populateAuditLog() {
    const container = document.getElementById('audit-log-container');

    try {
        // 1. Fetch users and log data in parallel
        const [usersResponse, logResponse] = await Promise.all([
            fetch('/api/users-sensitive'),
            fetch('/api/audit-log')
        ]);

        if (!usersResponse.ok || !logResponse.ok) {
            throw new Error('Failed to fetch required data.');
        }

        const users = await usersResponse.json();
        const auditLog = await logResponse.json();
        const userMap = new Map(users.map(user => [user.id, user]));

        if (auditLog.length === 0) {
            container.innerHTML = html`<p class="loading">No games found.</p>`;
            return;
        }

        // 2. Process each log entry and create its HTML card
        const entriesHtml = auditLog.map(rev => {
            const author = userMap.get(rev.author_id) || { name: 'Unknown', email: 'N/A' };
            const player1 = userMap.get(rev.player1_id) || { name: 'Unknown' };
            const player2 = userMap.get(rev.player2_id) || { name: 'Unknown' };
            const winner = userMap.get(rev.winner_id) || { name: 'Unknown' };


            // Format data for display
            const actionText = rev.revision_id === 0 
                ? 'created a new record' 
                : 'updated an existing record';
            
            const authoredDate = new Date(rev.authored_at).toLocaleString('en-GB');
            const playedDate = new Date(rev.played_at).toLocaleDateString('en-GB');
            const rematchText = rev.rematch_id === 0 ? 'First Match' : eta.render(`Rematch {{= it.rematch_id }}`, rev);
            const fouledText = rev.fouled_on_black ? 'Yes' : 'No';

            return eta.render(html`
                <div class="audit-entry">
                    <div class="audit-entry-header">
                        <h3>{{= it.author.name }} {{= it.actionText }}</h3>
                        <p class="meta">on {{= it.authoredDate }} (by {{= it.author.email }})</p>
                    </div>
                    <div class="audit-details">
                        <h4>{{= it.player1.name }} vs. {{= it.player2.name }} ({{= it.rematchText }})</h4>
                        <ul>
                            <li><strong>Winner:</strong> {{= it.winner.name }}</li>
                            <li><strong>Date Played:</strong> {{= it.playedDate }}</li>
                            <li><strong>Balls Remaining:</strong> {{= it.rev.balls_remaining }}</li>
                            <li><strong>Fouled on Black:</strong> {{= it.fouledText }}</li>
                        </ul>
                    </div>
                </div>
            `, { actionText, authoredDate, author, player1, player2, winner, playedDate, rematchText, fouledText, rev });
        }).join('');

        // 3. Populate the container
        container.innerHTML = entriesHtml;

    } catch (error) {
        console.error("Error populating audit log:", error);
        container.innerHTML = html`<p class="error">Failed to load audit log. ${error.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', populateAuditLog);