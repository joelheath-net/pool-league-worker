export const TermsOfServicePage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Terms of Service</h1>
            
            <div style="background: #fff; padding: 25px 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.6; color: #333; margin-bottom: 30px;">
                <p style="margin-top: 0; color: #666; font-size: 0.9em;">Last updated: September 2026</p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 20px;">1. Acceptance of Terms</h2>
                <p>
                    Welcome to St Paul's League ("we", "our", or "us"). By accessing or using our website 
                    (<code>stpaulsleague.joelheath.net</code>) and signing in through Google, you agree to comply with and be bound by 
                    these Terms of Service. If you do not agree to these terms, please do not use the service.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">2. Eligibility & Access</h2>
                <p>
                    St Paul's League is an organized sports tracking platform for league players and supporters. 
                    While public pages (such as the <a href="/about" style="color: #007bff;">About page</a>, Leaderboard, Game List, and Season Archive) are accessible to all visitors without logging in, 
                    interactive features (such as logging matches, modifying profiles, or accessing administration tools) require an authorized 
                    Google account included on the league's player whitelist.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">3. User Authentication & Accounts</h2>
                <p>
                    Authentication is provided solely through Google Sign-In. You are responsible for maintaining the security of your Google 
                    account and any activity that takes place under your credentials. If you suspect unauthorized access to your account, you 
                    should revoke access via your Google Account settings and inform the league administrator immediately.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">4. Fair Play & Match Recording</h2>
                <p>
                    Integrity and fair play are essential to the league. When logging or editing match results:
                </p>
                <ul style="padding-left: 20px;">
                    <li>You must record accurate, honest, and agreed-upon game outcomes, scores, and dates.</li>
                    <li>Every match submission and edit is permanently recorded with an author timestamp in the public Audit Log.</li>
                    <li>Deliberate falsification of game statistics, scores, or participants may result in revision reversal and suspension from the league.</li>
                </ul>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">5. Conduct & Custom Profile Content</h2>
                <p>
                    Players may customize their display name, team name, and team colour. You agree not to submit any content that is 
                    unlawful, abusive, harassing, defamatory, vulgar, or otherwise objectionable. The league administrator reserves the right 
                    to edit or reset any names or customizations that violate community standards.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">6. Service Availability & Disclaimers</h2>
                <p>
                    This platform is provided on an "as is" and "as available" basis without warranties of any kind, whether express or implied. 
                    While we strive for high uptime and accurate data preservation, we are not liable for temporary service interruptions, 
                    unintended data inaccuracies, or loss of access.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">7. Changes to Terms</h2>
                <p>
                    We reserve the right to modify these Terms at any time. Any changes will be posted on this page with an updated revision date. 
                    Your continued use of the platform after changes have been posted constitutes your acceptance of the revised Terms.
                </p>

                <h2 style="color: #333; font-size: 1.25em; margin-top: 25px;">8. Contact</h2>
                <p>
                    If you have questions or concerns regarding these Terms of Service, please contact the league administrator at{' '}
                    <a href="mailto:contact@stpaulsleague.joelheath.net" style="color: #007bff;">contact@stpaulsleague.joelheath.net</a> or visit{' '}
                    <a href="https://www.joelheath.net" target="_blank" rel="noopener noreferrer" style="color: #007bff;">joelheath.net</a>.
                </p>
            </div>
        </div>
    );
};
