import { Hono } from 'hono';
import { protectAdminAPI } from './middleware.js';

const admin = new Hono();


admin.post('/reset-db', protectAdminAPI, async (c) => {
    
    /*
    await c.env.DB.prepare('DROP TABLE IF EXISTS game_revisions').run();
    // await c.env.DB.prepare('DROP TABLE IF EXISTS users').run();
    

    const statements = c.env.SETUP_SQL.split('\r\n\r\n\r\n')
        .map(statement => statement.split('\r\n')
            .map(line => line.trim().replace('\r', '').replace('\n', ''))
            // replace multiple spaces with single space
            .map(line => line.replace(/\s+/g, ' '))
            .filter(line => line.length > 0 && !line.startsWith('--'))
            .reduce((acc, line) => acc + ' ' + line, '')
            .trim()
        ).map(sql => c.env.DB.prepare(sql));

    const results = await c.env.DB.batch(statements);
    */

    // Delete all from game_revisions
    const results = await c.env.DB.prepare('DELETE FROM game_revisions').run();

    return new Response("Database setup complete!\n" + JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    });
});

admin.post('/delete-user/:id', protectAdminAPI, async (c) => {
    const id = c.req.param('id');
    if (!id) {
        return c.json({ error: 'User ID is required' }, 400);
    }
    try {
        const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
        if (result.changes === 0) {
            return c.json({ error: 'User not found' }, 404);
        }
        return c.json({ message: 'User deleted successfully' }, 200);
    } catch (error) {
        console.error('Error deleting user:', error);
        return c.json({ error: 'Failed to delete user' }, 500);
    }
});

export default admin;