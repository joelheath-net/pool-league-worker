import { html } from 'hono/html'

export const MobileStyles = ({ cutoff = "500px" } = {}) => {
    return html`
        <style>
            /* Dynamic mobile navigation (applied via JS when content width exceeds available header space) */
            header.is-mobile-nav nav {
                display: none;
                flex-direction: column;
                align-items: stretch;
                width: 100%;
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                height: auto;
                border-radius: 0;
                background-color: #ffffff;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                padding: 0;
                margin: 0;
                -webkit-app-region: no-drag;
                app-region: no-drag;
            }

            header.is-mobile-nav nav.is-active {
                display: flex;
            }

            header.is-mobile-nav nav a {
                text-align: center;
                display: block;
                box-sizing: border-box;
                width: 100%;
                padding: 15px;
                border-radius: 0;
                border-top: 1px solid #f4f4f9;
                border-bottom: 1px solid #f4f4f9;
                background-color: #ffffff;
                font-size: 0.95rem;
                -webkit-app-region: no-drag;
                app-region: no-drag;
            }

            header.is-mobile-nav nav a:hover,
            header.is-mobile-nav nav a.active {
                background-color: #007bff;
                color: #ffffff;
            }

            header.is-mobile-nav .hamburger-menu {
                display: flex;
            }

            /* Responsive media query fallback for narrow viewports */
            @media (max-width: ${cutoff || "500px"}) {
                header nav {
                    display: none;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    height: auto;
                    border-radius: 0;
                    background-color: #ffffff;
                    z-index: 1000;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    padding: 0;
                    margin: 0;
                    -webkit-app-region: no-drag;
                    app-region: no-drag;
                }

                header nav.is-active {
                    display: flex;
                }

                header nav a {
                    text-align: center;
                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    padding: 15px;
                    border-radius: 0;
                    border-top: 1px solid #f4f4f9;
                    border-bottom: 1px solid #f4f4f9;
                    background-color: #ffffff;
                    font-size: 0.95rem;
                    -webkit-app-region: no-drag;
                    app-region: no-drag;
                }

                header nav a:hover,
                header nav a.active {
                    background-color: #007bff;
                    color: #ffffff;
                }

                header .hamburger-menu {
                    display: flex;
                }
            }

            /* In Windows PWA (WCO), mobile menu rows match header titlebar height */
            @media (display-mode: window-controls-overlay) {
                header.is-mobile-nav nav a {
                    height: env(titlebar-area-height, 33px);
                    min-height: env(titlebar-area-height, 33px);
                    padding: 0 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            }

            @media (display-mode: window-controls-overlay) and (max-width: ${cutoff || "500px"}) {
                header nav a {
                    height: env(titlebar-area-height, 33px);
                    min-height: env(titlebar-area-height, 33px);
                    padding: 0 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            }
        </style>
    `;
};