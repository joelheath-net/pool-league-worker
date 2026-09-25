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
            <meta name="theme-color" content="#ffffff" />

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
                        "sameAs": [
                            "https://www.instagram.com/stpaulsleague/"
                        ],
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
            <div data-nosnippet style="display: contents;">
                <a href="/log-game">Record New Game</a>
                <a href="/game-list">View Games List</a>
                <a href="/seasons">Season Archive</a>
                ${isAdmin
                    ? html`<a href="/admin-panel">Admin Dashboard</a>`
                    : ''}
                <a href="/profile">Customise Profile</a>
                <a href="/auth/logout">Logout</a>
            </div>
        </nav>
    `;

    const unauthenticatedNav = html`
        <nav>
            <div data-nosnippet style="display: contents;">
                <a href="/game-list">View Games List</a>
                <a href="/seasons">Season Archive</a>
                <a href="/auth/google/login">Sign In</a>
            </div>
        </nav>
    `;

    return html`
        <header>
            <div class="logo" style="display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; flex-shrink: 0;">
                <a href="/" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; white-space: nowrap; flex-shrink: 0;">St Paul's League</a>
                <a
                    href="https://www.instagram.com/stpaulsleague/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="instagram-btn"
                    aria-label="Follow St Paul's League on Instagram"
                    title="Follow St Paul's League on Instagram"
                    style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; color: inherit; text-decoration: none; line-height: 0; flex-shrink: 0;"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="currentColor"
                        aria-hidden="true"
                        focusable="false"
                        style="display: block; width: 20px; height: 20px;"
                    >
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                </a>
            </div>
            
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
    const cutoff = "500px";
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
                <div data-nosnippet style="display: contents;">
                    <p>&copy; ${new Date().getFullYear()} St Paul's League. All rights reserved.</p>
                    <p>Sponsored by&nbsp;<a target="_blank" rel="noopener noreferrer" href="https://www.joelheath.net">joelheath.net</a>.</p>
                    <p><a href="/about">About</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<a href="/privacy-policy">Privacy Policy</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;<a href="/terms-of-service">Terms and Conditions</a></p>
                </div>
            </footer>

            
            <script src="https://cdn.jsdelivr.net/npm/eta/dist/browser/eta.min.js"></script>
            <script src="/js/main.js"></script>
            ${script}
        </body>
        </html>
    `;
};