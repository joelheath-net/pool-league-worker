/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Hono } from 'hono';
import { authContextMiddleware } from './middleware';
import authRoutes from './auth';
import apiRoutes from './api';
import webRoutes from './web';
import adminRoutes from './admin';
import { Layout } from '../views/layout';
import { NotFoundPage } from '../views/not-found';

const authenticatedApp = new Hono();

authenticatedApp.use('*', authContextMiddleware);

authenticatedApp.route('/api', apiRoutes);
authenticatedApp.route('/admin', adminRoutes);
authenticatedApp.route('/', webRoutes);


const app = new Hono();

app.route('/auth', authRoutes);
app.route('/', authenticatedApp);

app.notFound((c) => {
    if (c.req.path.startsWith('/api') || c.req.path.startsWith('/admin') || c.req.path.startsWith('/auth')) {
        return c.json({ message: 'Not Found' }, 404);
    }
    return c.html(
        <Layout
            title="Page Not Found - St Paul's League"
            description="The page you are looking for does not exist or may have been moved."
            robots="noindex, nofollow"
            canonicalUrl={`https://stpaulsleague.joelheath.net${c.req.path}`}
            isAuthenticated={c.get('isAuthenticated')}
            isAdmin={c.get('isAdmin')}
        >
            <NotFoundPage />
        </Layout>,
        404
    );
});

export default app;