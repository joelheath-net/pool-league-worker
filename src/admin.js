import { Hono } from 'hono';
import { protectAdminAPI } from './middleware.js';
import * as db from './database.js';

const admin = new Hono();

admin.use('*', protectAdminAPI);

admin.post('/reset-db', async (c) => {
    const results = await db.resetGames(c.env.DB);
    return c.json({ message: "All game records have been deleted.", ...results });
});

admin.post('/delete-user/:id', async (c) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'User ID is required' }, 400);
    try {
        const result = await db.deleteUser(c.env.DB, id);
        if (result.changes === 0)
            return c.json({ error: 'User not found' }, 404);

        return c.json({ message: 'User deleted successfully' }, 200);
    } catch (error) {
        console.error('Error deleting user:', error);
        return c.json({ error: 'Failed to delete user' }, 500);
    }
});

admin.get('/whitelist', async (c) => {
    try {
        const whitelist = await db.getWhitelistedEmails(c.env.DB);
        return c.json(whitelist);
    } catch (error) {
        console.error('Error fetching whitelist:', error);
        return c.json({ error: 'Failed to fetch whitelist' }, 500);
    }
});

admin.post('/whitelist', async (c) => {
    try {
        const { email } = await c.req.json();
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return c.json({ error: 'Valid email address is required' }, 400);
        }

        await db.addWhitelistedEmail(c.env.DB, email);
        return c.json({ message: 'Email added to whitelist' }, 201);
    } catch (error) {
        console.error('Error adding email to whitelist:', error);
        return c.json({ error: 'Failed to add email to whitelist' }, 500);
    }
});

admin.delete('/whitelist/:email', async (c) => {
    try {
        const rawEmail = c.req.param('email');
        const email = decodeURIComponent(rawEmail);
        if (!email) {
            return c.json({ error: 'Email parameter is required' }, 400);
        }

        await db.removeWhitelistedEmail(c.env.DB, email);
        return c.json({ message: 'Email removed from whitelist' });
    } catch (error) {
        console.error('Error removing email from whitelist:', error);
        return c.json({ error: 'Failed to remove email from whitelist' }, 500);
    }
});

admin.post('/archive-season', async (c) => {
    try {
        const { seasonName } = await c.req.json();
        if (!seasonName) {
            return c.json({ error: 'Season name is required' }, 400);
        }
        const result = await db.archiveSeason(c.env.DB, seasonName);
        return c.json({ message: 'Season archived successfully', ...result });
    } catch (error) {
        console.error('Error archiving season:', error);
        return c.json({ error: error.message || 'Failed to archive season' }, 500);
    }
});

admin.post('/update-players', async (c) => {
    try {
        const { players } = await c.req.json();
        if (!Array.isArray(players)) {
            return c.json({ error: 'Invalid players data format. Expected an array of players' }, 400);
        }

        for (const p of players) {
            if (!p.id || typeof p.name !== 'string' || !p.name.trim()) {
                return c.json({ error: 'Each player must have an ID and a non-empty name' }, 400);
            }
            if (typeof p.team !== 'string' || !p.team.trim()) {
                return c.json({ error: `Player "${p.name}" must have a non-empty team name` }, 400);
            }
            if (!p.teamColor || !/^#[0-9a-fA-F]{6}$/.test(p.teamColor)) {
                return c.json({ error: `Invalid team colour for "${p.name}". Must be in format #RRGGBB` }, 400);
            }
        }

        const updatedCount = await db.updatePlayers(c.env.DB, players);
        return c.json({ message: 'Players updated successfully', updatedCount });
    } catch (error) {
        console.error('Error updating players:', error);
        return c.json({ error: error.message || 'Failed to update players' }, 500);
    }
});

admin.post('/update-participation', async (c) => {
    try {
        const { participations } = await c.req.json();
        if (!Array.isArray(participations)) {
            return c.json({ error: 'Invalid participations data format. Expected array of { id, participating }' }, 400);
        }

        const updatedCount = await db.updateUsersParticipation(c.env.DB, participations);
        return c.json({ message: 'Participation updated successfully', updatedCount });
    } catch (error) {
        console.error('Error updating participation:', error);
        return c.json({ error: error.message || 'Failed to update participation' }, 500);
    }
});

export default admin;