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

admin.post('/import-games', protectAdminAPI, async (c) => {
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
        const statements = await Promise.all(gamesToProcess.map(async (game) => {
            const latestRevision = await c.env.DB.prepare(
                `SELECT revision_id FROM game_revisions
                 WHERE player1_id = ? AND player2_id = ? AND rematch_id = ?
                 ORDER BY revision_id DESC LIMIT 1`
            ).bind(game.player1_id, game.player2_id, game.rematch_id).first();

            const newRevisionId = latestRevision ? latestRevision.revision_id + 1 : 0;
            
            return c.env.DB.prepare(
                `INSERT INTO game_revisions (revision_id, player1_id, player2_id, rematch_id, winner_id, balls_remaining, fouled_on_black, played_at, author_id, authored_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                newRevisionId,
                game.player1_id,
                game.player2_id,
                game.rematch_id,
                game.winner_id,
                game.balls_remaining,
                game.fouled_on_black,
                game.played_at,
                game.author_id,
                game.authored_at
            );
        }));

        if (statements.length > 0) {
            await c.env.DB.batch(statements);
        }

        return c.json({ importedCount: statements.length });

    } catch (error) {
        console.error('Error importing games:', error);
        return c.json({ error: 'Failed to import games. Check data for errors or duplicates.' }, 500);
    }
});

export default admin;