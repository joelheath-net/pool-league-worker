import { Hono } from 'hono';
import publicRoutes from './public.js';
import authenticatedRoutes from './authenticated.js';
import participatingRoutes from './participating.js';
import adminRoutes from './admin.js';

const api = new Hono();

api.route('/', publicRoutes);
api.route('/auth', authenticatedRoutes);
api.route('/participating', participatingRoutes);
api.route('/admin', adminRoutes);

export default api;
