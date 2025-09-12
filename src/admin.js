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
    const authorId = userPayload.sub;

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

        const winnerId = values[colMap.winnerId];
        const loserId = values[colMap.loserId];
        
        if (!winnerId || !loserId) continue;

        const player1Id = winnerId < loserId ? winnerId : loserId;
        const player2Id = winnerId < loserId ? loserId : winnerId;

        const rematchId = parseInt(values[colMap.rematchRound] || '1', 10) - 1;
        const ballsRemaining = parseInt(values[colMap.ballsRemaining] || '0', 10);
        const fouledOnBlack = (values[colMap.fouled] || 'FALSE').toUpperCase() === 'TRUE';
        
        let playedAt = new Date('2000-01-01').toISOString();
        if (values[colMap.date]) {
            // Handles 'DD/MM/YYYY' format
            const dateParts = values[colMap.date].split(/[\s/]/); // split by space or slash
            if (dateParts.length >= 3) {
                 const [day, month, year] = dateParts;
                 playedAt = new Date(`${year}-${month}-${day}`).toISOString();
            }
        }

        gamesToProcess.push({
            player1Id,
            player2Id,
            rematchId,
            winnerId,
            ballsRemaining,
            fouledOnBlack,
            playedAt,
            authorId,
            authoredAt: new Date().toISOString()
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

export default admin;