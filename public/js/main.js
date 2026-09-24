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

function initHeader() {
    const header = document.querySelector('header');
    if (!header) return;

    const hamburgerMenu = header.querySelector('.hamburger-menu') || document.querySelector('.hamburger-menu');
    const nav = header.querySelector('nav');
    const logo = header.querySelector('.logo');

    if (hamburgerMenu && nav) {
        hamburgerMenu.addEventListener('click', () => {
            nav.classList.toggle('is-active');
        });
    }

    if (!logo || !nav) return;

    let lastKnownNavWidth = 0;
    let lastKnownLogoWidth = 0;

    function getAvailableContentWidth() {
        const cs = window.getComputedStyle(header);
        const pl = parseFloat(cs.paddingLeft) || 0;
        const pr = parseFloat(cs.paddingRight) || 0;
        return header.clientWidth - pl - pr;
    }

    function measureDesktopNavWidth() {
        if (lastKnownNavWidth > 0 && !header.classList.contains('is-mobile-nav')) {
            const measured = Math.ceil(nav.getBoundingClientRect().width);
            if (measured > 0) {
                lastKnownNavWidth = measured;
                return measured;
            }
        }

        const wasMobile = header.classList.contains('is-mobile-nav');
        if (wasMobile) {
            header.classList.remove('is-mobile-nav');
        }

        const clone = nav.cloneNode(true);
        clone.style.cssText = 'position: absolute !important; top: -9999px !important; left: -9999px !important; display: inline-flex !important; flex-direction: row !important; width: max-content !important; max-width: none !important; visibility: hidden !important; pointer-events: none !important; white-space: nowrap !important;';
        clone.classList.remove('is-active');

        const links = clone.querySelectorAll('a');
        links.forEach((a) => {
            a.style.width = 'auto';
            a.style.display = 'inline-block';
            a.style.whiteSpace = 'nowrap';
        });

        header.appendChild(clone);
        const measured = Math.ceil(clone.getBoundingClientRect().width || clone.offsetWidth);
        header.removeChild(clone);

        if (wasMobile) {
            header.classList.add('is-mobile-nav');
        }

        if (measured > 0) {
            lastKnownNavWidth = measured;
        }

        return lastKnownNavWidth;
    }

    function checkFit() {
        const isMobile = header.classList.contains('is-mobile-nav');
        const minGap = 25; // Natural breathing room between logo and navigation links

        if (!isMobile) {
            // Live desktop mode: check actual on-screen positions
            const logoRect = logo.getBoundingClientRect();
            const navRect = nav.getBoundingClientRect();

            // Wait until elements are laid out
            if (logoRect.width === 0 || navRect.width === 0) return;

            lastKnownLogoWidth = Math.ceil(logoRect.width);
            lastKnownNavWidth = Math.ceil(navRect.width);

            const currentGap = navRect.left - logoRect.right;
            const isWrapping = navRect.top > (logoRect.bottom - 4);

            // Switch to mobile only when the elements are about to collide or wrap
            if (currentGap < minGap || isWrapping) {
                header.classList.add('is-mobile-nav');
            }
        } else {
            // Mobile mode: determine if available header width can fit desktop elements
            const availableWidth = getAvailableContentWidth();
            const navWidth = lastKnownNavWidth > 0 ? lastKnownNavWidth : measureDesktopNavWidth();
            const logoWidth = lastKnownLogoWidth > 0 ? lastKnownLogoWidth : Math.ceil(logo.getBoundingClientRect().width);

            const neededWidth = logoWidth + navWidth + minGap;

            // Switch back to desktop with 10px hysteresis to prevent jitter/flapping
            if (availableWidth >= neededWidth + 10) {
                header.classList.remove('is-mobile-nav');
                nav.classList.remove('is-active');

                // Update exact measurements from live DOM layout
                requestAnimationFrame(() => {
                    const nr = nav.getBoundingClientRect();
                    const lr = logo.getBoundingClientRect();
                    if (nr.width > 0) lastKnownNavWidth = Math.ceil(nr.width);
                    if (lr.width > 0) lastKnownLogoWidth = Math.ceil(lr.width);
                });
            }
        }
    }

    // Initial measurement & layout check
    measureDesktopNavWidth();
    lastKnownLogoWidth = Math.ceil(logo.getBoundingClientRect().width);
    checkFit();

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            measureDesktopNavWidth();
            lastKnownLogoWidth = Math.ceil(logo.getBoundingClientRect().width);
            checkFit();
        });
    }

    window.addEventListener('resize', checkFit, { passive: true });

    if ('windowControlsOverlay' in navigator) {
        navigator.windowControlsOverlay.addEventListener('geometrychange', () => {
            checkFit();
            window.dispatchEvent(new Event('resize'));
        });
    }

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            checkFit();
        });
        ro.observe(header);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
} else {
    initHeader();
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.update();
    }).catch((err) => {
        console.error('ServiceWorker registration failed:', err);
    });
}


// Cleanly deregister push subscription on device prior to logging out
document.addEventListener('click', async (event) => {
    const logoutLink = event.target.closest('a[href="/auth/logout"]');
    if (!logoutLink) return;

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        event.preventDefault();
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                await fetch('/api/push-unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: sub.endpoint })
                }).catch(() => {});
                await sub.unsubscribe().catch(() => {});
            }
        } catch (err) {
            console.warn('[Push] Unsubscribe on logout failed:', err);
        } finally {
            window.location.href = logoutLink.href;
        }
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