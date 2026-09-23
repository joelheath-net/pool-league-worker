export const AuditPage = () => {
    return (
        <div class="container centre-container">
            <div class="audit-log-container">
                <h1 class="centre-title">Audit Log</h1>
                <div id="audit-log-container">
                    <p class="loading">Loading audit log...</p>
                </div>
            </div>

            <div style="text-align: center; margin-top: 24px; margin-bottom: 24px;">
                <a href="/game-list" class="secondary-link">Back to Game History</a>
            </div>
        </div>
    );
};