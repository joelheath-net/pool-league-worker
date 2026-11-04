import { Hono } from 'hono';
import { protectAPI } from '../middleware.js';
import * as db from '../database.js';
import { sendTestNotification } from '../push-service.js';

const authenticatedApi = new Hono();

authenticatedApi.use('*', protectAPI);

authenticatedApi.get('/users-sensitive', async (c) => {
    const users = await db.getSensitiveUsers(c.env.DB);
    return c.json(users);
});

authenticatedApi.get('/push-status', async (c) => {
    const userPayload = c.get('user');
    const subscribed = await db.hasPushSubscription(c.env.DB, userPayload.sub);
    return c.json({ subscribed });
});

authenticatedApi.post('/push-subscribe', async (c) => {
    const userPayload = c.get('user');
    const body = await c.req.json();

    if (!body || !body.endpoint || !body.keys || !body.keys.p256dh || !body.keys.auth) {
        return c.json({ message: 'Invalid subscription data format' }, 400);
    }

    await db.savePushSubscription(c.env.DB, userPayload.sub, {
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth
    });

    return c.json({ message: 'Subscribed successfully' });
});

authenticatedApi.post('/push-test', async (c) => {
    const userPayload = c.get('user');
    try {
        const result = await sendTestNotification(c.env, userPayload.sub);
        return c.json({ message: 'Test notification sent successfully', result });
    } catch (err) {
        return c.json({ message: err.message || 'Failed to send test notification' }, 400);
    }
});

authenticatedApi.get('/profile', async (c) => {
    const userPayload = c.get('user');
    if (!userPayload) return c.json({ message: 'Unauthorized' }, 401);

    return c.json(await db.getUserById(c.env.DB, userPayload.sub));
});

authenticatedApi.patch('/profile', async (c) => {
    const userPayload = c.get('user');
    const profileData = await c.req.json();

    if (!/^#[0-9a-fA-F]{6}$/.test(profileData.teamColor)) {
        return c.json({ message: 'Invalid team color format. Must be hex color codes in format #RRGGBB' }, 400);
    }

    await db.updateProfile(c.env.DB, userPayload.sub, profileData);
    return c.json({ message: 'Profile updated successfully' });
});

authenticatedApi.get('/audit-log', async (c) => {
    const revisions = await db.getAuditLog(c.env.DB);
    return c.json(revisions);
});

export default authenticatedApi;
