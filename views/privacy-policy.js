export const PrivacyPolicyPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Privacy Policy</h1>
            
            <div style="background: #fff; padding: 25px 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.6; color: #333; margin-bottom: 30px;">
                <p style="margin-top: 0; color: #666; font-size: 0.9em;">Last updated: September 2026</p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 20px;">1. Introduction</h2>
                <p>
                    St Paul's League ("we", "our", or "us") provides a pool league tracker and leaderboard for players.
                    This Privacy Policy explains how we collect, use, and safeguard your information when you use our service, 
                    including when signing in with your Google account.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">2. Information We Collect</h2>
                <p>We collect only the minimum necessary information required to operate the league:</p>
                <ul style="padding-left: 20px;">
                    <li><strong>Google Account Information:</strong> When you sign in using Google, we access basic profile details via OAuth scopes (<code>openid</code>, <code>profile</code>, and <code>email</code>). This includes your Google account identifier (sub), display name, and email address.</li>
                    <li><strong>Authentication Tokens:</strong> We receive and store OAuth access and refresh tokens to maintain your login session across visits without requiring repeated logins.</li>
                    <li><strong>League Data:</strong> Match results, game revisions, team names, customized team colours, and participation status entered through the application.</li>
                </ul>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">3. How We Use Your Information</h2>
                <p>Your information is used strictly to provide league functionality:</p>
                <ul style="padding-left: 20px;">
                    <li>To authenticate your identity and verify your eligibility against the league whitelist.</li>
                    <li>To display player names, team affiliations, and game statistics on the public leaderboard and season archives.</li>
                    <li>To record and audit games logged by players.</li>
                    <li>To preserve your sign-in session securely using HTTP cookies and JWT tokens.</li>
                </ul>
                <p>We do not sell, rent, or use your personal data for advertising, marketing, or profiling.</p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">4. Data Sharing & Visibility</h2>
                <p>
                    Player names, team names, team colours, match scores, and ranking statistics are publicly visible on the league table and match history.
                    Your email address and Google authentication tokens are kept strictly confidential, accessible only by the system and authorized league administrators, and are never made public.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">5. Data Storage and Security</h2>
                <p>
                    Data is stored securely in Cloudflare D1 distributed databases. Sign-in cookies are configured with <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code> flags to prevent unauthorized access and cross-site scripting attacks.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">6. Data Retention & Revoking Access</h2>
                <p>
                    We retain your information as long as you remain a participant in the league. You may request deletion of your account and personal details at any time by contacting the administrator.
                </p>
                <p>
                    You can also revoke St Paul's League's access to your Google account at any time through your{' '}
                    <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style="color: #007bff;">Google Account Third-Party Access Settings</a>.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">7. Contact</h2>
                <p>
                    If you have questions about this Privacy Policy or wish to request data deletion, please contact the league administrator at{' '}
                    <a href="mailto:contact@stpaulsleague.joelheath.net" style="color: #007bff;">contact@stpaulsleague.joelheath.net</a> or visit{' '}
                    <a href="https://www.joelheath.net" target="_blank" rel="noopener noreferrer" style="color: #007bff;">joelheath.net</a>.
                </p>
            </div>
        </div>
    );
};
