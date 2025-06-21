import { html } from 'hono/html'

const Header = ({ isAuthenticated }) => {
    const headerClass = isAuthenticated ? 'header is-authenticated' : 'header';

    const authenticatedNav = html`
        <nav>
            <a href="/log-game">Record New Game</a>
            <a href="/game-list">View Games List</a>
            <a href="/audit-log">View Audit Log</a>
            <a href="/profile">Customise Profile</a>
            <a href="/auth/logout">Logout</a>
        </nav>
    `;

    const unauthenticatedNav = html`
        <nav>
            <a href="/auth/google">Sign In</a>
        </nav>
    `;

    return html`
        <header class="${headerClass}">
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
    return html`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${props.title}</title>
            <link rel="stylesheet" href="/css/style.css" />
            ${props.style ? html`<link rel="stylesheet" href="${props.style}" />` : ''}
        </head>
        <body>
            ${<Header isAuthenticated={props.isAuthenticated} />}

            <main style="flex-grow: 1;">
                ${props.children}
            </main>

            <footer>
                <p>&copy; ${new Date().getFullYear()} St Paul's League. All rights reserved.</p>
                <p>Sponsored by <a href="https://www.joelheath.net">joelheath.net</a>.</p>
                <p>Subscribe to <a href="https://youtube.joelheath.net">joelheath24</a>.</p>
            </footer>

            <script src="/js/main.js"></script>
            ${props.script ? html`<script src="${props.script}"></script>` : ''}
        </body>
        </html>
    `;
};