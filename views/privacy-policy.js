export const PrivacyPolicyPage = () => {
    return (
        <div class="container centre-container">
            <h1 class="centre-title">Privacy Policy</h1>
            
            <div style="background: #fff; padding: 25px 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); line-height: 1.6; color: #333; margin-bottom: 30px;">
                <p style="margin-top: 0; color: #666; font-size: 0.9em;">
                    <strong>Effective Date:</strong> September 2026 | <strong>Last Updated:</strong> September 2026
                </p>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 25px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    1. Introduction & Application Identity
                </h2>
                <p>
                    This Privacy Policy applies to <strong>St Paul's League</strong> (the "Application", accessible at{' '}
                    <a href="https://stpaulsleague.joelheath.net" style="color: #007bff;">https://stpaulsleague.joelheath.net</a> and its homepage at{' '}
                    <a href="https://stpaulsleague.joelheath.net/about" style="color: #007bff;">https://stpaulsleague.joelheath.net/about</a>), 
                    developed and maintained by <strong>Joel Heath</strong> (<a href="https://www.joelheath.net" target="_blank" rel="noopener noreferrer" style="color: #007bff;">joelheath.net</a>, "we", "our", or "us").
                </p>
                <p>
                    St Paul's League is an online sports tournament tracking platform that manages cue sports standings, match scoring, team profiles, and season history. 
                    This Privacy Policy comprehensively explains how our application accesses, collects, uses, stores, protects, and discloses personal information and Google user data when you interact with our website or sign in using your Google account.
                </p>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    2. Google User Data We Access and Collect
                </h2>
                <p>
                    When you sign in to St Paul's League using Google Sign-In (OAuth 2.0), our application accesses the data you have provided to Google through specific, minimum necessary OAuth scopes:
                </p>
                <ul style="padding-left: 20px;">
                    <li style="margin-bottom: 12px;">
                        <strong><code>openid</code> scope:</strong>
                        <br />
                        Accesses your unique Google user identifier (<code>sub</code>). This identifier is used to recognize your unique player profile across login sessions and link your match history and preferences without requiring a username or password.
                    </li>
                    <li style="margin-bottom: 12px;">
                        <strong><code>profile</code> scope (<code>https://www.googleapis.com/auth/userinfo.profile</code>):</strong>
                        <br />
                        Accesses your basic Google profile details, specifically your display name, given name, family name, and profile picture URL. This is used solely to display your player name and avatar on the public league standings, match scores, and player rosters.
                    </li>
                    <li style="margin-bottom: 12px;">
                        <strong><code>email</code> scope (<code>https://www.googleapis.com/auth/userinfo.email</code>):</strong>
                        <br />
                        Accesses your verified Google email address. This is used exclusively to verify your identity against the league's authorized player whitelist, confirming that you are an approved league participant permitted to record and edit match scores.
                    </li>
                </ul>
                <p>
                    In addition to Google user data, we collect or process the following categories of data when you use or interact with our products and services:
                </p>
                <ul style="padding-left: 20px;">
                    <li><strong>Authentication & Session Tokens:</strong> Secure OAuth access tokens, refresh tokens, and encrypted JSON Web Tokens (JWT) stored in HTTP cookies to preserve your login session.</li>
                    <li><strong>League Activity & Match Data:</strong> Match scores, opponents, dates of games played, fouls recorded, customized team names, team colors, and audit trail records.</li>
                </ul>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    3. How We Use Google User Data
                </h2>
                <p>
                    We will use your data strictly to provide you with the services you requested. Specifically, Google user data is used for:
                </p>
                <ul style="padding-left: 20px;">
                    <li>Authenticating your identity and confirming that your email address is on the authorized league player roster.</li>
                    <li>Associating your game results, match scores, and ranking points with your player profile.</li>
                    <li>Displaying your player name on the public leaderboard, game history, and season archives.</li>
                    <li>Maintaining an open, transparent audit log of match submissions and edits to preserve sportsmanship and competition integrity.</li>
                    <li>Maintaining your secure authentication session so you do not need to repeatedly log in during each visit.</li>
                </ul>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    4. Google API Services Limited Use & Non-Commercialization Policy
                </h2>
                <p>
                    St Paul's League strictly limits its use of Google user data to providing user-facing features that are prominent in the application's user interface.
                </p>
                <p style="background: #f8f9fa; border-left: 4px solid #007bff; padding: 14px 18px; margin: 15px 0; border-radius: 0 4px 4px 0;">
                    <strong>Google API User Data Policy Compliance:</strong><br />
                    St Paul's League's use and transfer of information received from Google APIs to any other app will adhere to the{' '}
                    <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style="color: #007bff; font-weight: 500;">
                        Google API Services User Data Policy
                    </a>, including the Limited Use requirements.
                </p>
                <p>In adherence to Google's Limited Use policy, we explicitly state:</p>
                <ul style="padding-left: 20px;">
                    <li><strong>We do NOT sell, rent, or lease your Google user data:</strong> We never sell, transfer, or disclose your personal information or Google user data to data brokers, information resellers, or commercial third parties.</li>
                    <li><strong>We do NOT use Google user data for advertising:</strong> We do not use or transfer your data for targeted advertising, personalized ads, retargeted advertisements, or interest-based advertising.</li>
                    <li><strong>We do NOT use Google user data for credit or lending:</strong> We do not use user data to determine creditworthiness or for any lending evaluations.</li>
                    <li><strong>We do NOT use Google user data to train AI/ML models:</strong> We explicitly affirm that Google user data and Google API data are not used to develop, improve, or train non-personalized or generalized artificial intelligence (AI) and/or machine learning (ML) models.</li>
                </ul>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    5. Sharing, Transfer, and Disclosure of Google User Data
                </h2>
                <p>
                    We do not transfer or disclose your Google user data to third parties for purposes other than the ones provided in this policy.
                </p>
                <p>Data disclosure is handled as follows:</p>
                <ul style="padding-left: 20px;">
                    <li style="margin-bottom: 8px;">
                        <strong>Public League Information:</strong> Player display names, team names, team accent colours, match scores, standings, and audit history are publicly visible on the website to other players and visitors to fulfill the core sports league tracking service.
                    </li>
                    <li style="margin-bottom: 8px;">
                        <strong>Confidential User Information:</strong> Your Google email address, Google user ID (<code>sub</code>), OAuth tokens, and session credentials are strictly confidential. They are never published, never displayed publicly, and never shared with other users.
                    </li>
                    <li style="margin-bottom: 8px;">
                        <strong>Service Providers:</strong> We use Cloudflare, Inc. (Cloudflare Workers edge runtime and Cloudflare D1 distributed SQL database) for hosting, routing, and data storage. Cloudflare operates as a data processor bound by strict confidentiality and data protection obligations.
                    </li>
                    <li style="margin-bottom: 8px;">
                        <strong>Legal Disclosures:</strong> We will only disclose your data if strictly required by applicable law, regulation, legal process, or governmental request.
                    </li>
                </ul>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    6. Data Protection and Security Mechanisms
                </h2>
                <p>
                    Security procedures are in place to protect the confidentiality, integrity, and security of your data. We use encryption to protect your information:
                </p>
                <ul style="padding-left: 20px;">
                    <li><strong>Encryption in Transit:</strong> All HTTP communications between your browser and our servers are encrypted using modern Transport Layer Security (TLS/HTTPS).</li>
                    <li><strong>Encrypted Authentication Cookies:</strong> Authentication tokens are stored in browser cookies configured with <code>HttpOnly</code>, <code>Secure</code>, and <code>SameSite=Lax</code> security attributes, mitigating cross-site scripting (XSS) and cross-site request forgery (CSRF) vulnerabilities.</li>
                    <li><strong>Secure Storage at Rest:</strong> Application data and refresh tokens are stored in secured Cloudflare D1 distributed databases, restricted by fine-grained Cloudflare IAM credentials with no external direct database access.</li>
                    <li><strong>Automated Expiration & Refresh:</strong> JWT access tokens are short-lived, and refresh operations are validated server-side against authorized whitelisted profiles.</li>
                </ul>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    7. Data Retention and Deletion
                </h2>
                <p>
                    We store your personal information for a period of time that is consistent with our business purposes and league operations.
                </p>
                <ul style="padding-left: 20px;">
                    <li>
                        <strong>Retention Period:</strong> We will retain your personal information for the length of time needed to fulfill the purposes outlined in this privacy policy (specifically for the duration of the player's active participation in the league and ongoing season history) unless a longer retention period is required or permitted by law.
                    </li>
                    <li>
                        <strong>Data Deletion on Expiry:</strong> When the data retention period expires for a given type of data, or when a user account is removed from the active league roster, we will delete or destroy it.
                    </li>
                    <li>
                        <strong>User Deletion Requests:</strong> You may request for your data to be deleted at any time. To request deletion of your account and personal details, email the league administrator at{' '}
                        <a href="mailto:contact@stpaulsleague.joelheath.net" style="color: #007bff;">contact@stpaulsleague.joelheath.net</a>. 
                        Upon receiving and verifying your request, we will permanently delete your Google account ID, email address, OAuth tokens, and profile preferences from our active database within 30 days.
                    </li>
                    <li>
                        <strong>Revoking Google Access:</strong> You can revoke St Paul's League's access to your Google account at any time through your{' '}
                        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" style="color: #007bff; font-weight: 500;">
                            Google Account Third-Party Access Settings
                        </a>. Revoking access immediately prevents our application from refreshing or obtaining any further information from Google.
                    </li>
                </ul>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    8. Children's Privacy
                </h2>
                <p>
                    Our application is not intended for or directed toward children under the age of 13. We do not knowingly collect or solicit personal data from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take immediate steps to delete that data from our systems.
                </p>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    9. Changes to this Privacy Policy
                </h2>
                <p>
                    We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or Google API policy updates. 
                    Any updates will be posted on this page with an updated "Last Updated" date. If significant changes occur affecting how Google user data is handled, we will notify registered players prominently through the application interface.
                </p>

                <h2 style="color: #222; font-size: 1.3em; margin-top: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                    10. Contact Us
                </h2>
                <p>
                    If you have questions, concerns, or requests regarding this Privacy Policy, your personal data, or our data handling practices, please contact us:
                </p>
                <p>
                    <strong>Application:</strong> St Paul's League (<a href="https://stpaulsleague.joelheath.net/about" style="color: #007bff;">stpaulsleague.joelheath.net/about</a>)<br />
                    <strong>Developer / Administrator:</strong> Joel Heath<br />
                    <strong>Website:</strong> <a href="https://www.joelheath.net" target="_blank" rel="noopener noreferrer" style="color: #007bff;">https://www.joelheath.net</a><br />
                    <strong>Email:</strong> <a href="mailto:contact@stpaulsleague.joelheath.net" style="color: #007bff;">contact@stpaulsleague.joelheath.net</a>
                </p>
            </div>
        </div>
    );
};
