/**
 * Fetches all revisions and users, then populates the audit log.
 */
async function populateAuditLog() {
    const container = document.querySelector('#audit-log-container');

    try {
        // 1. Fetch users and log data in parallel
        const [usersResponse, logResponse] = await Promise.all([
            fetch('/api/auth/users-sensitive'),
            fetch('/api/auth/audit-log')
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
            const author = userMap.get(rev.authorId) || { name: 'Unknown', email: 'N/A' };
            const homePlayer = userMap.get(rev.homePlayerId) || { name: 'Unknown' };
            const awayPlayer = userMap.get(rev.awayPlayerId) || { name: 'Unknown' };
            const winner = rev.winnerHome ? homePlayer : awayPlayer;

            const isDeleted = Boolean(rev.isDeleted);
            const actionText = isDeleted
                ? 'deleted a game'
                : (rev.revisionId === 0
                    ? 'created a new record'
                    : 'updated an existing record');

            const authoredDate = new Date(rev.authoredAt).toLocaleString('en-GB');
            const playedDate = new Date(rev.playedAt).toLocaleDateString('en-GB');
            const rematchText = rev.rematchId === 0 ? 'First Match' : eta.render(`Rematch {{= it.rematchId }}`, rev);
            const fouledText = rev.fouledOnBlack ? 'Yes' : 'No';

            return eta.render(html`
                <div class="audit-entry {{= it.isDeleted ? 'audit-entry-deleted' : '' }}">
                    <div class="audit-entry-header">
                        <h3>{{= it.author.name }} {{= it.actionText }}</h3>
                        <p class="meta">on {{= it.authoredDate }} (by {{= it.author.email }})</p>
                    </div>
                    <div class="audit-details">
                        <h4>{{= it.homePlayer.name }} vs. {{= it.awayPlayer.name }} ({{= it.rematchText }})</h4>
                        <ul>
                            <li><strong>Winner:</strong> {{= it.winner.name }}</li>
                            <li><strong>Date Played:</strong> {{= it.playedDate }}</li>
                            <li><strong>Balls Remaining:</strong> {{= it.rev.ballsRemaining }}</li>
                            <li><strong>Fouled on Black:</strong> {{= it.fouledText }}</li>
                        </ul>
                    </div>
                </div>
            `, { isDeleted, actionText, authoredDate, author, homePlayer, awayPlayer, winner, playedDate, rematchText, fouledText, rev });
        }).join('');

        // 3. Populate the container
        container.innerHTML = entriesHtml;
    } catch (error) {
        console.error('Error populating audit log:', error);
        container.innerHTML = html`<p class="error">Failed to load audit log. ${escapeHTML(error.message)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', populateAuditLog);
