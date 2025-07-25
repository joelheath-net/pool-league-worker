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

admin.post('/import-games', async (c) => {
    const tsvData = await c.req.text();
    const userPayload = await c.get('user');
    const author_id = userPayload.sub;

    const lines = tsvData.trim().split(/\r?\n/);
    const header = lines.shift().split('\t').map(h => h.trim());
    
    const colMap = {
        date: header.indexOf('Date'),
        winnerId: header.indexOf('Winner ID'),
        loserId: header.indexOf('Loser ID'),
        fouled: header.indexOf('Fouled on black'),
        ballsRemaining: header.indexOf('Balls Remaining'),
        rematchRound: header.indexOf('Rematch Round')
    };
    
    const gamesToProcess = [];

    for (const line of lines) {
        const values = line.split('\t').map(v => v.trim());

        const winner_id = values[colMap.winnerId];
        const loser_id = values[colMap.loserId];
        
        if (!winner_id || !loser_id) continue;

        const player1_id = winner_id < loser_id ? winner_id : loser_id;
        const player2_id = winner_id < loser_id ? loser_id : winner_id;

        const rematch_id = parseInt(values[colMap.rematchRound] || '1', 10) - 1;
        const balls_remaining = parseInt(values[colMap.ballsRemaining] || '0', 10);
        const fouled_on_black = (values[colMap.fouled] || 'FALSE').toUpperCase() === 'TRUE';
        
        let played_at = new Date('2000-01-01').toISOString();
        if (values[colMap.date]) {
            // Handles 'DD/MM/YYYY' format
            const dateParts = values[colMap.date].split(/[\s/]/); // split by space or slash
            if (dateParts.length >= 3) {
                 const [day, month, year] = dateParts;
                 played_at = new Date(`${year}-${month}-${day}`).toISOString();
            }
        }

        gamesToProcess.push({
            player1_id,
            player2_id,
            rematch_id,
            winner_id,
            balls_remaining,
            fouled_on_black,
            played_at,
            author_id,
            authored_at: new Date().toISOString()
        });
    }
    
    try {
        const importedCount = await db.importGames(c.env.DB, gamesToProcess);
        return c.json({ importedCount });
    } catch (error) {
        console.error('Error importing games:', error);
        return c.json({ error: 'Failed to import games. Check data for errors or duplicates.' }, 500);
    }
});

export default admin;