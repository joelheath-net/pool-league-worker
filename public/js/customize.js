/**
 * Fetches the current user profile and populates the form fields.
 */
async function loadProfile() {
    const nameInput = document.querySelector('#name');
    const teamInput = document.querySelector('#team');
    const colorInput = document.querySelector('#team-color');
    const form = document.querySelector('#profile-form');

    try {
        const response = await fetch('/api/profile');
        if (!response.ok) throw new Error('Failed to fetch profile');
        const profile = await response.json();

        // Populate the form with the fetched data
        nameInput.value = profile.name;
        teamInput.value = profile.team;
        colorInput.value = profile.teamColor;

    } catch (error) {
        console.error("Error loading profile:", error);
        form.innerHTML = html`<p>Could not load your profile. Please try again later.</p>`;
    }
}

// Add a submit handler to the form
document.querySelector('#profile-form').addEventListener('submit', async function(event) {
    // Prevent the default form submission behavior
    event.preventDefault(); 
    
    // Collect data from the form
    const formData = new FormData(event.target);
    const updates = Object.fromEntries(formData.entries());

    try {
        // PATCH the data to the server
        const response = await fetch('/api/profile', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error('Failed to save changes.');

        window.location.href = '/';

    } catch(error) {
        console.error('Error saving profile:', error);
        alert('An error occurred while saving. Please try again.');
    }
});

// Load the profile data and notification controls when the page is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadProfile();
        initPushNotifications();
    });
} else {
    loadProfile();
    initPushNotifications();
}

function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function isRunningPWA() {
    return Boolean(
        // Window Controls Overlay (desktop PWA on Windows / macOS / Linux)
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (navigator.windowControlsOverlay && navigator.windowControlsOverlay.visible) ||
        // Standalone PWA (Android / Windows / Chrome / Edge)
        window.matchMedia('(display-mode: standalone)').matches ||
        // Fullscreen or Minimal-UI PWA
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        // iOS Safari Add to Home Screen standalone mode
        window.navigator.standalone === true ||
        // Android Trusted Web App (TWA)
        document.referrer.includes('android-app://') ||
        // URL query parameter for debug/testing
        new URLSearchParams(window.location.search).has('pwa') ||
        new URLSearchParams(window.location.search).has('pwa_debug')
    );
}

async function getSWRegistration(timeoutMs = 4000) {
    if (!('serviceWorker' in navigator)) return null;

    try {
        const reg = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
        ]);
        return reg;
    } catch {
        return await navigator.serviceWorker.getRegistration();
    }
}

async function initPushNotifications() {
    const card = document.querySelector('#pwa-notifications-card');
    if (!card) return;

    const hasPushSupport = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const isPwa = isRunningPWA();

    // If on iOS Safari standard web tab (where PushManager is undefined until added to Home Screen)
    if (!hasPushSupport) {
        const statusBadge = document.querySelector('#push-status-badge');
        const toggleBtn = document.querySelector('#push-toggle-btn');
        const feedback = document.querySelector('#push-feedback');
        if (statusBadge) {
            statusBadge.textContent = 'Unsupported';
            statusBadge.className = 'push-status-badge badge-off';
        }
        if (toggleBtn) toggleBtn.style.display = 'none';
        if (feedback) {
            feedback.style.display = 'block';
            feedback.className = 'push-feedback';
            feedback.textContent = 'Push notifications require installing this app to your Home Screen / device.';
        }
        return;
    }

    const statusBadge = document.querySelector('#push-status-badge');
    const toggleBtn = document.querySelector('#push-toggle-btn');
    const testBtn = document.querySelector('#push-test-btn');
    const feedback = document.querySelector('#push-feedback');

    let vapidPublicKey = null;

    function setFeedback(msg, isError = false) {
        if (!feedback) return;
        if (!msg) {
            feedback.style.display = 'none';
            feedback.textContent = '';
            return;
        }
        feedback.style.display = 'block';
        feedback.className = `push-feedback ${isError ? 'push-feedback-error' : 'push-feedback-success'}`;
        feedback.textContent = msg;
    }

    async function updateUiState() {
        setFeedback('');

        try {
            if (!vapidPublicKey) {
                const configRes = await fetch('/api/push-config');
                if (configRes.ok) {
                    const config = await configRes.json();
                    vapidPublicKey = config.publicKey;
                }
            }

            if (!vapidPublicKey || vapidPublicKey === 'YOUR_VAPID_PUBLIC_KEY') {
                statusBadge.textContent = 'Key Needed';
                statusBadge.className = 'push-status-badge badge-off';
                toggleBtn.textContent = 'VAPID Key Missing';
                toggleBtn.disabled = true;
                setFeedback('VAPID public key not set in environment.', true);
                return;
            }

            if (Notification.permission === 'denied') {
                statusBadge.textContent = 'Blocked';
                statusBadge.className = 'push-status-badge badge-blocked';
                toggleBtn.textContent = 'Notifications Blocked';
                toggleBtn.disabled = true;
                testBtn.style.display = 'none';
                setFeedback('Notifications are blocked by your device settings. Allow them in app permissions to enable.', true);
                return;
            }

            const reg = await getSWRegistration();
            const sub = reg ? await reg.pushManager.getSubscription() : null;

            if (sub && Notification.permission === 'granted') {
                statusBadge.textContent = 'Active';
                statusBadge.className = 'push-status-badge badge-active';
                toggleBtn.textContent = 'Disable Notifications';
                toggleBtn.className = 'push-btn push-btn-danger';
                toggleBtn.disabled = false;
                testBtn.style.display = 'inline-block';
            } else {
                statusBadge.textContent = 'Off';
                statusBadge.className = 'push-status-badge badge-off';
                toggleBtn.textContent = 'Enable Notifications';
                toggleBtn.className = 'push-btn push-btn-primary';
                toggleBtn.disabled = false;
                testBtn.style.display = 'none';
            }
        } catch (err) {
            console.error('Error updating notification state:', err);
            statusBadge.textContent = 'Off';
            statusBadge.className = 'push-status-badge badge-off';
            toggleBtn.textContent = 'Enable Notifications';
            toggleBtn.disabled = false;
        }
    }

    toggleBtn.addEventListener('click', async () => {
        toggleBtn.disabled = true;
        setFeedback('');

        try {
            let reg = await getSWRegistration();
            if (!reg && 'serviceWorker' in navigator) {
                reg = await navigator.serviceWorker.register('/sw.js');
                await navigator.serviceWorker.ready;
            }

            const sub = reg ? await reg.pushManager.getSubscription() : null;

            if (sub) {
                // User wants to disable
                await fetch('/api/push-unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: sub.endpoint })
                }).catch(() => {});
                await sub.unsubscribe();
                setFeedback('Notifications disabled.');
            } else {
                // User wants to enable
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    await updateUiState();
                    return;
                }

                if (!reg) {
                    throw new Error('Service worker is not active.');
                }

                const newSub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
                });

                const res = await fetch('/api/push-subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newSub)
                });

                if (!res.ok) {
                    throw new Error('Failed to save push subscription on server');
                }

                setFeedback('Push notifications successfully enabled! You will be alerted when your rank changes.');
            }
        } catch (err) {
            console.error('Push toggle error:', err);
            setFeedback(err.message || 'An error occurred while updating notifications.', true);
        } finally {
            await updateUiState();
        }
    });

    testBtn.addEventListener('click', async () => {
        testBtn.disabled = true;
        const originalText = testBtn.textContent;
        testBtn.textContent = 'Sending...';

        try {
            const res = await fetch('/api/push-test', { method: 'POST' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to dispatch test notification');
            }
            setFeedback('Test notification sent! Check your device notifications.');
        } catch (err) {
            setFeedback(err.message, true);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    });

    await updateUiState();
}
