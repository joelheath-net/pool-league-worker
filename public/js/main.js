const html = (strings, ...values) => String.raw({ raw: strings }, ...values);

function escapeHTML(str) {
    if (str === undefined || str === null) return '';
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getContrastingTextColor(hexColor) {
    // Remove the hash at the start if it's there
    hexColor = hexColor.replace(/^#/, '');

    // Parse the R, G, B values
    const r = parseInt(hexColor.substring(0, 2), 16);
    const g = parseInt(hexColor.substring(2, 4), 16);
    const b = parseInt(hexColor.substring(4, 6), 16);

    // Calculate the perceptive luminance (aka luma) - human eye perception
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for bright colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const nav = document.querySelector('header nav');

    if (hamburgerMenu && nav) {
        hamburgerMenu.addEventListener('click', () => {
            nav.classList.toggle('is-active');
        });
    }
});

const eta = window.Eta;
eta.configure({
    tags: ["{{", "}}"]
});

function getWinLossRatio(player) {
    const wins = Number(player.wins) || 0;
    const losses = Number(player.losses) || 0;
    if (losses === 0) {
        return wins > 0 ? Infinity : 0;
    }
    return wins / losses;
}

function sortLeaderboardData(data, field, direction) {
    const isAsc = direction === 'asc';
    const mult = isAsc ? 1 : -1;

    return [...data].sort((a, b) => {
        if (field === 'points') {
            if (a.points !== b.points) {
                return (a.points - b.points) * mult;
            }
            if (a.ballsRemaining !== b.ballsRemaining) {
                return a.ballsRemaining - b.ballsRemaining;
            }
            return a.foulsOnBlack - b.foulsOnBlack;
        }

        if (field === 'winLossRatio') {
            const aRatio = getWinLossRatio(a);
            const bRatio = getWinLossRatio(b);

            if (aRatio !== bRatio) {
                if (aRatio === Infinity) return isAsc ? 1 : -1;
                if (bRatio === Infinity) return isAsc ? -1 : 1;
                return (aRatio - bRatio) * mult;
            }

            if (a.wins !== b.wins) {
                return (a.wins - b.wins) * mult;
            }
            if (a.points !== b.points) {
                return (a.points - b.points) * mult;
            }
            if (a.ballsRemaining !== b.ballsRemaining) {
                return a.ballsRemaining - b.ballsRemaining;
            }
            return a.foulsOnBlack - b.foulsOnBlack;
        }

        if (field === 'foulsOnBlack') {
            if (a.foulsOnBlack !== b.foulsOnBlack) {
                return (a.foulsOnBlack - b.foulsOnBlack) * mult;
            }
            return b.points - a.points;
        }

        if (field === 'ballsRemaining') {
            if (a.ballsRemaining !== b.ballsRemaining) {
                return (a.ballsRemaining - b.ballsRemaining) * mult;
            }
            return b.points - a.points;
        }

        if (field === 'wins') {
            if (a.wins !== b.wins) {
                return (a.wins - b.wins) * mult;
            }
            return b.points - a.points;
        }

        if (field === 'losses') {
            if (a.losses !== b.losses) {
                return (a.losses - b.losses) * mult;
            }
            return b.points - a.points;
        }

        if (field === 'played') {
            if (a.played !== b.played) {
                return (a.played - b.played) * mult;
            }
            return b.points - a.points;
        }

        if (field === 'name') {
            return (a.name || '').localeCompare(b.name || '') * mult;
        }

        if (typeof a[field] === 'number' && typeof b[field] === 'number') {
            return (a[field] - b[field]) * mult;
        }

        return String(a[field] || '').localeCompare(String(b[field] || '')) * mult;
    });
}

function renderLeaderboardRows(players, tbodySelector) {
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;

    if (!players || players.length === 0) {
        tbody.innerHTML = html`
            <tr>
                <td colspan="9" style="text-align: center; color: #888; padding: 20px 0;">
                    <div class="table-cell">No player data available.</div>
                </td>
            </tr>
        `;
        return;
    }

    const rowsHtml = players.map(playerStats => {
        const color = playerStats.teamColor || '#ffffff';
        const textColor = getContrastingTextColor(color);
        const winLossRatio = playerStats.winLossRatio !== undefined
            ? playerStats.winLossRatio
            : (playerStats.losses > 0 ? (playerStats.wins / playerStats.losses).toFixed(2) : (playerStats.wins > 0 ? "∞" : "0.00"));
        const played = playerStats.played !== undefined
            ? playerStats.played
            : (playerStats.wins + playerStats.losses);

        return eta.render(html`
            <tr>
                <td class="sticky" style="background-color: {{= it.color }}"><div class="table-cell" style="color: {{= it.textColor }}">{{= it.name }}</div></td>
                <td style="background-color: {{= it.color }}"><div class="table-cell" style="color: {{= it.textColor }}">{{= it.team }}</div></td>
                <td><div class="table-cell">{{= it.points }}</div></td>
                <td><div class="table-cell">{{= it.wins }}</div></td>
                <td><div class="table-cell">{{= it.losses }}</div></td>
                <td><div class="table-cell">{{= it.foulsOnBlack }}</div></td>
                <td><div class="table-cell">{{= it.ballsRemaining }}</div></td>
                <td><div class="table-cell">{{= it.played }}</div></td>
                <td><div class="table-cell">{{= it.winLossRatio }}</div></td>
            </tr>
        `, { ...playerStats, color, textColor, played, winLossRatio });
    }).join('');

    tbody.innerHTML = rowsHtml;
}

function setupLeaderboardControls({ getData, onRender }) {
    let currentSortField = 'points';
    let currentSortDirection = 'desc';

    const toggleBtn = document.querySelector('#sort-toggle-btn');
    const sortPanel = document.querySelector('#sort-panel');
    const sortSelect = document.querySelector('#sort-select');
    const sortOrderBtn = document.querySelector('#sort-order-btn');
    const sortOrderIcon = document.querySelector('#sort-order-icon');
    const table = document.querySelector('.table-container table');
    const tableContainer = document.querySelector('.table-container');
    const controls = document.querySelector('.leaderboard-controls');

    function alignControls() {
        if (!table || !controls) return;
        const tableWidth = table.offsetWidth;
        if (tableWidth > 0) {
            const availableWidth = tableContainer ? tableContainer.clientWidth : window.innerWidth;
            const targetWidth = Math.min(tableWidth, availableWidth);
            controls.style.maxWidth = `${targetWidth}px`;
            controls.style.width = '100%';
            controls.style.marginLeft = 'auto';
            controls.style.marginRight = 'auto';
        }
    }

    function checkOverflow() {
        if (tableContainer) {
            const isOverflowing = tableContainer.scrollWidth > tableContainer.clientWidth;
            tableContainer.classList.toggle('is-overflowing', isOverflowing);
        }
    }

    function updateSortDirectionBtn() {
        if (!sortOrderBtn || !sortOrderIcon) return;
        if (currentSortDirection === 'desc') {
            sortOrderBtn.classList.remove('sort-asc');
            sortOrderBtn.classList.add('sort-desc');
            sortOrderIcon.innerHTML = '&darr;';
            sortOrderBtn.setAttribute('title', 'Descending order (click for ascending)');
            sortOrderBtn.setAttribute('aria-label', 'Descending order, click to sort ascending');
        } else {
            sortOrderBtn.classList.remove('sort-desc');
            sortOrderBtn.classList.add('sort-asc');
            sortOrderIcon.innerHTML = '&uarr;';
            sortOrderBtn.setAttribute('title', 'Ascending order (click for descending)');
            sortOrderBtn.setAttribute('aria-label', 'Ascending order, click to sort descending');
        }
    }

    function apply() {
        const data = getData();
        const sorted = sortLeaderboardData(data, currentSortField, currentSortDirection);
        onRender(sorted);
        requestAnimationFrame(() => {
            alignControls();
            checkOverflow();
        });
    }

    if (toggleBtn && controls) {
        toggleBtn.addEventListener('click', () => {
            const isOpen = controls.classList.toggle('is-open');
            if (sortPanel) sortPanel.classList.toggle('is-open', isOpen);
            toggleBtn.classList.toggle('is-open', isOpen);
            toggleBtn.setAttribute('title', isOpen ? 'Hide sorting options' : 'Show sorting options');
            toggleBtn.setAttribute('aria-label', isOpen ? 'Hide sorting options' : 'Show sorting options');
            requestAnimationFrame(() => {
                alignControls();
                checkOverflow();
            });
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSortField = e.target.value;
            apply();
        });
    }

    if (sortOrderBtn) {
        sortOrderBtn.addEventListener('click', () => {
            currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
            updateSortDirectionBtn();
            apply();
        });
    }

    if (window.ResizeObserver && table) {
        const ro = new ResizeObserver(() => {
            alignControls();
            checkOverflow();
        });
        ro.observe(table);
    }

    window.addEventListener('resize', () => {
        alignControls();
        checkOverflow();
    });

    updateSortDirectionBtn();
    apply();

    return { apply, alignControls, checkOverflow };
}