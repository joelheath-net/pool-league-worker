import { html } from 'hono/html'
import { MobileStyles } from './mobile-style';

const Head = ({ title, description, robots, style, cutoff, canonicalUrl }) => {
    const defaultDescription = "Track upcoming fixtures, past results, and league standings for St Paul's Pool League.";
    const metaDescription = description || defaultDescription;
    const pageCanonicalUrl = canonicalUrl || "https://stpaulsleague.joelheath.net";

    return html`
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${title}</title>
            <link rel="canonical" href="${pageCanonicalUrl}" />

            <!-- Favicon and Apple Touch Icons -->
            <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
            <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png" />
            <link rel="manifest" href="/site.webmanifest" />

            <!-- Open Graph / Discord -->
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${metaDescription}" />
            <meta property="og:image" content="https://stpaulsleague.joelheath.net/images/logo-hd.jpg" />
            <meta property="og:image:width" content="640" />
            <meta property="og:image:height" content="640" />
            <meta property="og:image:alt" content="St Paul's Pool League Logo" />
            <meta property="og:url" content="${pageCanonicalUrl}" />
            <meta property="og:site_name" content="St Paul's League" />
            <meta property="og:locale" content="en_GB" />
            <meta property="og:type" content="website" />
            <meta name="theme-color" content="#fd7c28" />

            <!-- Twitter / X -->
            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content="${title}" />
            <meta name="twitter:description" content="${metaDescription}" />
            <meta name="twitter:image" content="https://stpaulsleague.joelheath.net/images/logo-hd.jpg" />
            <meta name="twitter:image:alt" content="St Paul's Pool League Logo" />

            <!-- Meta Tags & SEO -->
            <meta name="application-name" content="St Paul's League" lang="en" />
            <meta name="apple-mobile-web-app-title" content="St Paul's" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
            <meta name="description" content="${metaDescription}" />
            ${robots ? html`<meta name="robots" content="${robots}" />` : ''}
            <meta name="author" content="Joel Heath" />
            <meta name="msapplication-TileColor" content="#fd7c28" />

            <!-- Schema.org Structured Data -->
            <script type="application/ld+json">
            {
                "@context": "https://schema.org",
                "@graph": [
                    {
                        "@type": "SportsOrganization",
                        "@id": "https://stpaulsleague.joelheath.net/#organization",
                        "name": "St Paul's League",
                        "alternateName": "St Paul's Pool League",
                        "url": "https://stpaulsleague.joelheath.net",
                        "logo": "https://stpaulsleague.joelheath.net/images/logo-hd.jpg",
                        "sport": "8-Ball Pool",
                        "description": "Official tournament management and live standings platform for St Paul's Pool League.",
                        "founder": {
                            "@type": "Person",
                            "name": "Joel Heath",
                            "url": "https://www.joelheath.net"
                        }
                    },
                    {
                        "@type": "WebSite",
                        "@id": "https://stpaulsleague.joelheath.net/#website",
                        "url": "https://stpaulsleague.joelheath.net",
                        "name": "St Paul's League",
                        "publisher": {
                            "@id": "https://stpaulsleague.joelheath.net/#organization"
                        },
                        "inLanguage": "en-GB"
                    }
                ]
            }
            </script>
            
            <!-- Stylesheets -->
            <link rel="stylesheet" href="/css/style.css" />
            ${style}
            ${<MobileStyles cutoff={cutoff}  />}
        </head>
    `;
};

const Header = ({ isAuthenticated, isAdmin }) => {
    const authenticatedNav = html`
        <nav>
            <a href="/log-game">Record New Game</a>
            <a href="/game-list">View Games List</a>
            <a href="/seasons">Season Archive</a>
            ${isAdmin
                ? html`<a href="/admin-panel">Admin Dashboard</a>`
                : ''}
            <a href="/profile">Customise Profile</a>
            <a href="/auth/logout">Logout</a>
        </nav>
    `;

    const unauthenticatedNav = html`
        <nav>
            <a href="/game-list">View Games List</a>
            <a href="/seasons">Season Archive</a>
            <a href="/auth/google/login">Sign In</a>
        </nav>
    `;

    return html`
        <header>
            <div class="logo"><a href="/" style="text-decoration: none; color: inherit;">St Paul's League</a></div>
            
            <button class="hamburger-menu" aria-label="Open navigation menu">
                <span></span>
                <span></span>
                <span></span>
            </button>

            ${isAuthenticated ? authenticatedNav : unauthenticatedNav}
        </header>
    `;
};

export const Layout = (props) => {
    const cutoff = props.isAdmin ? "1250px" : props.isAuthenticated ? "1080px" : "600px";
    const style = props.style ? html`<link rel="stylesheet" href="${props.style}" />` : '';
    const script = props.script ? html`<script src="${props.script}"></script>` : '';

    return html`
        <!DOCTYPE html>
        <html lang="en">
        ${<Head title={props.title} description={props.description} robots={props.robots} style={style} cutoff={cutoff} canonicalUrl={props.canonicalUrl} />}
        <body>
            ${<Header isAuthenticated={props.isAuthenticated} isAdmin={props.isAdmin} />}

            <main style="flex-grow: 1;">
                ${props.children}
            </main>

            <footer>
                <p>&copy; ${new Date().getFullYear()} St Paul's League. All rights reserved.</p>
                <p>Sponsored by <a href="https://www.joelheath.net">joelheath.net</a>.</p>
                <p><a href="/about">About</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<a href="/privacy-policy">Privacy Policy</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<a href="/terms-of-service">Terms and Conditions</a></p>
            </footer>

            
            <script src="https://cdn.jsdelivr.net/npm/eta/dist/browser/eta.min.js"></script>
            <script src="/js/main.js"></script>
            ${script}
        </body>
        </html>
    `;
};