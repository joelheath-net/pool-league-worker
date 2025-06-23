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

const authenticatedApp = new Hono();

authenticatedApp.use('*', authContextMiddleware);

authenticatedApp.route('/', webRoutes);
authenticatedApp.route('/api', apiRoutes);
authenticatedApp.route('/admin', adminRoutes);


const app = new Hono();

app.route('/', authenticatedApp);
app.route('/auth', authRoutes);

export default app;