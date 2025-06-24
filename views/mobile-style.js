import { html } from 'hono/html'

export const MobileStyles = ({ cutoff }) => {
    return html`
        <style>
            @media (max-width: ${cutoff}) {
                header nav {
                    display: none;
                    flex-direction: column;
                    width: 100%;
                    position: absolute;
                    top: 52px; /* 2rem + 2 * 10 px of padding */
                    left: 0;
                    border-radius: none;
                    background-color: white;
                }

                header nav.is-active {
                    display: flex;
                }

                header nav a {
                    text-align: center;
                    padding: 15px;
                    border-top: 1px solid #f4f4f9;
                    border-bottom: 1px solid #f4f4f9;
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
        </style>
    `;
};