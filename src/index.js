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
import authRoutes from './auth';
import apiRoutes from './api';
import webRoutes from './web';

const app = new Hono();

app.route('/auth', authRoutes);
app.route('/api', apiRoutes);
app.route('/', webRoutes);

export default app;