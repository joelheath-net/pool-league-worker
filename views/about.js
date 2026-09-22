export const AboutPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">About St Paul's League</h1>
            
            <div style="background: #fff; padding: 25px 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.6; color: #333; margin-bottom: 30px;">
                <h2 style="color: #222; font-size: 1.35em; margin-top: 0; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    1. Application Overview
                </h2>
                <p>
                    <strong>St Paul's League</strong> (hosted at <a href="https://stpaulsleague.joelheath.net" style="color: #007bff;">stpaulsleague.joelheath.net</a>) 
                    is a dedicated sports tracking and tournament management platform created for pool and cue sports players participating in the St Paul's League. 
                    The application provides a comprehensive digital hub to record match scores, calculate standings, maintain player statistics, and preserve historical season archives.
                </p>
                <p>
                    Developed and maintained by <strong>Joel Heath</strong> (<a href="https://www.joelheath.net" target="_blank" rel="noopener noreferrer" style="color: #007bff;">joelheath.net</a>), 
                    the platform ensures fair play, transparent record-keeping, and friendly competition across all participating players and teams.
                </p>

                <h2 style="color: #222; font-size: 1.35em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    2. Features & Functionality
                </h2>
                <ul style="padding-left: 20px;">
                    <li style="margin-bottom: 10px;">
                        <strong>Live Standings & Leaderboard:</strong> Dynamic calculation of league points, match wins, losses, fouls on the black ball, total ball differences, played match counts, and win-to-loss ratios.
                    </li>
                    <li style="margin-bottom: 10px;">
                        <strong>Match Recording:</strong> Verified league players can log newly completed frames and matches, recording players, team representation, scores, fouls, and match dates.
                    </li>
                    <li style="margin-bottom: 10px;">
                        <strong>Transparent Public Audit Log:</strong> Every match submission, edit, and score revision is permanently timestamped and attributed in an open audit trail to ensure integrity and prevent disputes.
                    </li>
                    <li style="margin-bottom: 10px;">
                        <strong>Outstanding Match Schedule:</strong> Real-time tracking of unplayed fixtures across league rounds to keep tournament play on schedule.
                    </li>
                    <li style="margin-bottom: 10px;">
                        <strong>Season Archives:</strong> Permanent historical archives of concluded seasons, allowing players to review past champions and legacy tournament tables.
                    </li>
                    <li style="margin-bottom: 10px;">
                        <strong>Profile Customization:</strong> Players can personalize their display name, team name, and team accent colours shown across the leaderboard and match lists.
                    </li>
                </ul>

                <h2 style="color: #222; font-size: 1.35em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    3. Public Access Without Login
                </h2>
                <p>
                    St Paul's League believes in openness and accessibility. Anyone may browse and inspect the application without creating an account or logging in:
                </p>
                <ul style="padding-left: 20px;">
                    <li><a href="/" style="color: #007bff; font-weight: 500;">Current Leaderboard</a> — view live rankings, point totals, and player records.</li>
                    <li><a href="/game-list" style="color: #007bff; font-weight: 500;">Game History</a> — review all played matches and scores.</li>
                    <li><a href="/seasons" style="color: #007bff; font-weight: 500;">Season Archive</a> — explore past seasons and final standings.</li>
                    <li><a href="/outstanding-games" style="color: #007bff; font-weight: 500;">Outstanding Games</a> — check pending fixtures.</li>
                </ul>
                <p>
                    User sign-in is exclusively required for active participants who wish to submit new game results, modify their profile preferences, or access league administration tools.
                </p>

                <h2 style="color: #222; font-size: 1.35em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    4. Why We Use Google Sign-In & How Data Is Used
                </h2>
                <p>
                    St Paul's League utilizes Google OAuth 2.0 to provide a safe, modern, and passwordless authentication experience. 
                    Signing in with Google ensures that only authorized league members can log match results, protecting the competitive integrity of the league.
                </p>
                <p>
                    When signing in, our application requests the following minimum necessary Google OAuth scopes:
                </p>
                <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 12px 16px; margin: 15px 0; border-radius: 0 4px 4px 0;">
                    <p style="margin: 0 0 8px 0;"><strong>• openid</strong></p>
                    <p style="margin: 0; font-size: 0.95em; color: #555;">
                        <strong>Purpose:</strong> Verifies your identity with Google and issues a unique, permanent Google Account ID (<code>sub</code>). 
                        This ID allows our system to securely associate your login session with your existing league profile, match submissions, and team preferences without needing passwords.
                    </p>
                </div>
                <div style="background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 12px 16px; margin: 15px 0; border-radius: 0 4px 4px 0;">
                    <p style="margin: 0 0 8px 0;"><strong>• profile (userinfo.profile)</strong></p>
                    <p style="margin: 0; font-size: 0.95em; color: #555;">
                        <strong>Purpose:</strong> Retrieves your basic profile information (display name and avatar). 
                        This is used strictly to display your name as a player on the public leaderboard, match scorecards, and audit logs.
                    </p>
                </div>
                <div style="background-color: #f8f9fa; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 15px 0; border-radius: 0 4px 4px 0;">
                    <p style="margin: 0 0 8px 0;"><strong>• email (userinfo.email)</strong></p>
                    <p style="margin: 0; font-size: 0.95em; color: #555;">
                        <strong>Purpose:</strong> Confirms your Google email address to verify your account against the league's authorized player whitelist. 
                        This ensures only approved tournament players have write permissions to record match scores or edit games.
                    </p>
                </div>

                <h2 style="color: #222; font-size: 1.35em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    5. Privacy, Security & Limited Data Use
                </h2>
                <p>
                    We place the highest priority on user privacy and data protection:
                </p>
                <ul style="padding-left: 20px;">
                    <li><strong>No Commercial Sale:</strong> We never sell, rent, lease, trade, or monetize your personal information or Google user data.</li>
                    <li><strong>No Advertising:</strong> We do not use Google user data for targeted advertising, retargeting, interest-based advertisements, or profiling.</li>
                    <li><strong>No AI Model Training:</strong> Google user data is never used to develop, improve, or train generalized or non-personalized machine learning (ML) or artificial intelligence (AI) models.</li>
                    <li><strong>Google Limited Use Compliance:</strong> St Paul's League's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style="color: #007bff;">Google API Services User Data Policy</a>, including the Limited Use requirements.</li>
                    <li><strong>Secure Storage & Encryption:</strong> All communications are encrypted in transit via HTTPS / TLS. Authentication sessions are managed via encrypted, <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code> cookies stored in modern Cloudflare D1 distributed databases.</li>
                </ul>

                <h2 style="color: #222; font-size: 1.35em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    6. User Control & Data Deletion
                </h2>
                <p>
                    You have complete control over your data. You may request account deletion or removal of your personal information at any time by contacting us at{' '}
                    <a href="mailto:contact@stpaulsleague.joelheath.net" style="color: #007bff;">contact@stpaulsleague.joelheath.net</a>. 
                    Requests are fulfilled within 30 days.
                </p>
                <p>
                    You may also revoke St Paul's League's access to your Google account at any time through your{' '}
                    <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style="color: #007bff;">Google Account Third-Party Access Settings</a>.
                </p>

                <h2 style="color: #222; font-size: 1.35em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    7. Legal & Contact Information
                </h2>
                <p>
                    For detailed information regarding our privacy practices and user terms, please review our official policies:
                </p>
                <ul style="padding-left: 20px;">
                    <li><a href="/privacy-policy" style="color: #007bff; font-weight: 500;">Privacy Policy</a></li>
                    <li><a href="/terms-of-service" style="color: #007bff; font-weight: 500;">Terms of Service</a></li>
                </ul>
                <p>
                    <strong>Developer & Operator:</strong> Joel Heath<br />
                    <strong>Website:</strong> <a href="https://www.joelheath.net" target="_blank" rel="noopener noreferrer" style="color: #007bff;">https://www.joelheath.net</a><br />
                    <strong>Application URL:</strong> <a href="https://stpaulsleague.joelheath.net" style="color: #007bff;">https://stpaulsleague.joelheath.net</a><br />
                    <strong>Email:</strong> <a href="mailto:contact@stpaulsleague.joelheath.net" style="color: #007bff;">contact@stpaulsleague.joelheath.net</a>
                </p>
            </div>
        </div>
    );
};
