import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { authContextMiddleware, protectAdminWeb, protectWeb } from '../src/middleware.js';
import authRoutes from '../src/auth.js';
import apiRoutes from '../src/api.js';
import adminRoutes from '../src/admin.js';
import { accessTokenExpiresIn, refreshTokenExpiresIn, signAuthToken } from '../src/token-service.js';

const REAL_SECRET = 'super-strong-random-test-secret-key-0123456789abcdef';
const ATTACKER_SECRET = 'attacker-guessed-wrong-secret';

const toBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

function createMockDb({
    users = {},
    whitelistedEmails = ['admin@example.com', 'player@example.com'],
    deletedPushForUsers = []
} = {}) {
    const whitelistSet = new Set(whitelistedEmails.map((e) => e.toLowerCase()));

    return {
        deletedPushForUsers,
        prepare(sql) {
            return {
                bind(...params) {
                    return {
                        async first() {
                            if (sql.includes('FROM whitelisted_emails')) {
                                const email = String(params[0] || '').toLowerCase();
                                return whitelistSet.has(email) ? { email } : null;
                            }
                            if (sql.includes('SELECT id, email, role, google_refresh_token FROM users')) {
                                const user = users[params[0]];
                                return user
                                    ? {
                                          id: user.id,
                                          email: user.email,
                                          role: user.role,
                                          google_refresh_token: user.google_refresh_token
                                      }
                                    : null;
                            }
                            if (sql.includes('SELECT id, name, email, role FROM users')) {
                                const user = users[params[0]];
                                return user
                                    ? {
                                          id: user.id,
                                          name: user.name,
                                          email: user.email,
                                          role: user.role
                                      }
                                    : null;
                            }
                            return null;
                        },
                        async all() {
                            if (sql.includes('FROM whitelisted_emails')) {
                                return {
                                    results: Array.from(whitelistSet).map((email) => ({
                                        email,
                                        created_at: '2026-01-01T00:00:00Z'
                                    }))
                                };
                            }
                            return { results: [] };
                        },
                        async run() {
                            if (sql.includes('DELETE FROM push_subscriptions WHERE user_id = ?')) {
                                deletedPushForUsers.push(params[0]);
                            }
                            if (sql.includes('INSERT INTO users')) {
                                const [id, name, email, accessToken, expiresAt, refreshToken] = params;
                                users[id] = {
                                    id,
                                    name,
                                    email,
                                    role: 'user',
                                    google_access_token: accessToken,
                                    google_access_token_expires_at: expiresAt,
                                    google_refresh_token: refreshToken
                                };
                            }
                            if (sql.startsWith('UPDATE users SET') && sql.includes('google_access_token')) {
                                const userId = params[params.length - 1];
                                if (users[userId]) {
                                    users[userId].google_access_token = params[0];
                                    users[userId].google_access_token_expires_at = params[1];
                                    if (sql.includes('google_refresh_token = ?')) {
                                        users[userId].google_refresh_token = params[2];
                                    }
                                }
                            }
                            return { changes: 1, meta: { last_row_id: 1 } };
                        }
                    };
                },
                async all() {
                    if (sql.includes('FROM whitelisted_emails')) {
                        return {
                            results: Array.from(whitelistSet).map((email) => ({
                                email,
                                created_at: '2026-01-01T00:00:00Z'
                            }))
                        };
                    }
                    return { results: [] };
                }
            };
        }
    };
}

function buildTestApp() {
    const authenticatedApp = new Hono();
    authenticatedApp.use('*', authContextMiddleware);
    authenticatedApp.route('/api', apiRoutes);
    authenticatedApp.route('/admin', adminRoutes);
    authenticatedApp.get('/admin-panel', protectAdminWeb, (c) => c.text('ADMIN_OK'));
    authenticatedApp.get('/log-game', protectWeb, (c) => c.text('LOG_GAME_OK'));

    const app = new Hono();
    app.route('/auth', authRoutes);
    app.route('/', authenticatedApp);
    return app;
}

describe('JWT & Auth Security', () => {
    let originalFetch;
    let baseEnv;
    let mockUsers;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        mockUsers = {
            'admin-google-sub-123': {
                id: 'admin-google-sub-123',
                name: 'Joel',
                email: 'admin@example.com',
                role: 'admin',
                google_refresh_token: 'valid-google-refresh-token-admin'
            },
            'player-google-sub-456': {
                id: 'player-google-sub-456',
                name: 'Friend',
                email: 'player@example.com',
                role: 'user',
                google_refresh_token: 'valid-google-refresh-token-player'
            }
        };

        baseEnv = {
            JWT_SECRET: REAL_SECRET,
            GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
            GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
            DB: createMockDb({ users: mockUsers })
        };

        globalThis.fetch = vi.fn(async (url) => {
            if (String(url) === 'https://oauth2.googleapis.com/token') {
                return new Response(
                    JSON.stringify({
                        access_token: 'refreshed-google-access-token',
                        expires_in: 3600
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
            throw new Error(`Unexpected fetch to ${url}`);
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('BLOCKS forged expired JWT with admin sub from triggering server-side refresh or accessing admin routes', async () => {
        const app = buildTestApp();

        // Exact pen-test vector #1: expired JWT with admin sub and fake/wrong signature
        const forgedExpiredJwt = `${toBase64Url({ alg: 'HS256', typ: 'JWT' })}.${toBase64Url({
            sub: 'admin-google-sub-123',
            role: 'admin',
            exp: 1
        })}.forged_signature_bytes`;

        const adminWebRes = await app.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${forgedExpiredJwt}` } },
            baseEnv
        );
        expect(adminWebRes.status).toBe(302);
        expect(adminWebRes.headers.get('location')).toBe('/');
        expect(adminWebRes.headers.get('set-cookie')).toContain('auth_token=;');
        expect(globalThis.fetch).not.toHaveBeenCalled();

        const adminApiRes = await app.request(
            'https://stpaulsleague.joelheath.net/admin/whitelist',
            { headers: { Cookie: `auth_token=${forgedExpiredJwt}` } },
            baseEnv
        );
        expect(adminApiRes.status).toBe(401);
        expect(globalThis.fetch).not.toHaveBeenCalled();

        const logGameRes = await app.request(
            'https://stpaulsleague.joelheath.net/api/log-game',
            {
                method: 'POST',
                headers: {
                    Cookie: `auth_token=${forgedExpiredJwt}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            },
            baseEnv
        );
        expect(logGameRes.status).toBe(401);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('BLOCKS forged JWT signed with wrong secret on POST /auth/refresh', async () => {
        const app = buildTestApp();

        // Exact pen-test vector #2: calling POST /auth/refresh with an unverified or wrong-secret JWT
        const wrongSecretJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                role: 'admin',
                exp: Math.floor(Date.now() / 1000) + 900
            },
            ATTACKER_SECRET,
            'HS256'
        );

        const res = await app.request(
            'https://stpaulsleague.joelheath.net/auth/refresh',
            {
                method: 'POST',
                headers: { Cookie: `auth_token=${wrongSecretJwt}` }
            },
            baseEnv
        );

        expect(res.status).toBe(401);
        expect(res.headers.get('set-cookie')).toContain('auth_token=;');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('BLOCKS alg:none and tampered payloads on genuinely signed user tokens', async () => {
        const app = buildTestApp();

        const algNoneToken = `${toBase64Url({ alg: 'none', typ: 'JWT' })}.${toBase64Url({
            sub: 'admin-google-sub-123',
            role: 'admin',
            exp: Math.floor(Date.now() / 1000) + 900
        })}.`;

        const algNoneRes = await app.request(
            'https://stpaulsleague.joelheath.net/admin/whitelist',
            { headers: { Cookie: `auth_token=${algNoneToken}` } },
            baseEnv
        );
        expect(algNoneRes.status).toBe(401);

        // Legitimately signed non-admin user token
        const { jwt: validPlayerJwt } = await signAuthToken(
            { id: 'player-google-sub-456', email: 'player@example.com', role: 'user' },
            baseEnv
        );

        // Non-admin user gets 403 on admin endpoints
        const nonAdminRes = await app.request(
            'https://stpaulsleague.joelheath.net/admin/whitelist',
            { headers: { Cookie: `auth_token=${validPlayerJwt}` } },
            baseEnv
        );
        expect(nonAdminRes.status).toBe(403);

        // Tamper the payload of validPlayerJwt to escalate role to admin while keeping original signature
        const [headerPart, , sigPart] = validPlayerJwt.split('.');
        const tamperedJwt = `${headerPart}.${toBase64Url({
            sub: 'admin-google-sub-123',
            email: 'admin@example.com',
            role: 'admin',
            exp: Math.floor(Date.now() / 1000) + 900
        })}.${sigPart}`;

        const tamperedRes = await app.request(
            'https://stpaulsleague.joelheath.net/admin/whitelist',
            { headers: { Cookie: `auth_token=${tamperedJwt}` } },
            baseEnv
        );
        expect(tamperedRes.status).toBe(401);
    });

    it('BLOCKS forged JWT on GET /auth/logout from wiping another user push subscriptions', async () => {
        const app = buildTestApp();

        const forgedLogoutJwt = `${toBase64Url({ alg: 'HS256', typ: 'JWT' })}.${toBase64Url({
            sub: 'admin-google-sub-123',
            exp: Math.floor(Date.now() / 1000) + 900
        })}.forged`;

        const res = await app.request(
            'https://stpaulsleague.joelheath.net/auth/logout',
            { headers: { Cookie: `auth_token=${forgedLogoutJwt}` } },
            baseEnv
        );

        expect(res.status).toBe(302);
        expect(baseEnv.DB.deletedPushForUsers).toEqual([]);
    });

    it('ALLOWS valid server-signed expired JWT (within 90d window) to refresh seamlessly', async () => {
        const app = buildTestApp();
        const now = Math.floor(Date.now() / 1000);

        const genuinelySignedExpiredAdminJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                role: 'admin',
                iat: now - accessTokenExpiresIn - 60,
                exp: now - 60
            },
            REAL_SECRET,
            'HS256'
        );

        const res = await app.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${genuinelySignedExpiredAdminJwt}` } },
            baseEnv
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe('ADMIN_OK');
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(res.headers.get('set-cookie')).toMatch(/auth_token=eyJ/);
    });

    it('REJECTS refresh when expired token exceeds 90-day refresh lifetime or email is removed from whitelist', async () => {
        const app = buildTestApp();
        const now = Math.floor(Date.now() / 1000);

        // 1. Beyond 90-day refresh window
        const ancientSignedJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                role: 'admin',
                iat: now - refreshTokenExpiresIn - 100,
                exp: now - refreshTokenExpiresIn + accessTokenExpiresIn - 100
            },
            REAL_SECRET,
            'HS256'
        );

        const ancientRes = await app.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${ancientSignedJwt}` } },
            baseEnv
        );
        expect(ancientRes.status).toBe(302);
        expect(globalThis.fetch).not.toHaveBeenCalled();

        // 2. Removed from whitelist
        const unwhitelistedEnv = {
            ...baseEnv,
            DB: createMockDb({ users: mockUsers, whitelistedEmails: [] })
        };
        const recentlyExpiredJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                role: 'admin',
                iat: now - accessTokenExpiresIn - 10,
                exp: now - 10
            },
            REAL_SECRET,
            'HS256'
        );

        const unwhitelistedRes = await app.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${recentlyExpiredJwt}` } },
            unwhitelistedEnv
        );
        expect(unwhitelistedRes.status).toBe(302);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('INVALIDATES all active and expired JWTs immediately when JWT_SECRET is rotated', async () => {
        const app = buildTestApp();
        const { jwt: oldValidAdminJwt } = await signAuthToken(
            { id: 'admin-google-sub-123', email: 'admin@example.com', role: 'admin' },
            baseEnv
        );

        const rotatedEnv = {
            ...baseEnv,
            JWT_SECRET: 'brand-new-rotated-production-secret-9876543210'
        };

        const res = await app.request(
            'https://stpaulsleague.joelheath.net/admin/whitelist',
            { headers: { Cookie: `auth_token=${oldValidAdminJwt}` } },
            rotatedEnv
        );
        expect(res.status).toBe(401);
        expect(res.headers.get('set-cookie')).toContain('auth_token=;');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('VERIFIES OAuth state and Google JWKS RSA signature in /auth/google/callback', async () => {
        const app = buildTestApp();

        // Generate a real RSA-256 keypair to simulate Google's JWKS signing
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'RSASSA-PKCS1-v1_5',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            },
            true,
            ['sign', 'verify']
        );
        const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
        const googlePublicJwk = {
            ...publicJwk,
            kid: 'google-key-1',
            alg: 'RS256',
            use: 'sig'
        };

        const signedIdToken = await sign(
            {
                iss: 'https://accounts.google.com',
                aud: baseEnv.GOOGLE_CLIENT_ID,
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                email_verified: true,
                name: 'Joel',
                exp: Math.floor(Date.now() / 1000) + 3600
            },
            { ...privateJwk, alg: 'RS256', kid: 'google-key-1' },
            'RS256'
        );

        globalThis.fetch = vi.fn(async (url) => {
            if (String(url) === 'https://oauth2.googleapis.com/token') {
                return new Response(
                    JSON.stringify({
                        access_token: 'google-access-token',
                        refresh_token: 'google-refresh-token',
                        expires_in: 3600,
                        id_token: signedIdToken
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
            if (String(url) === 'https://www.googleapis.com/oauth2/v3/certs') {
                return new Response(JSON.stringify({ keys: [googlePublicJwk] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            throw new Error(`Unexpected fetch to ${url}`);
        });

        // Step 1: Start login and get oauth_state cookie
        const loginRes = await app.request(
            'https://stpaulsleague.joelheath.net/auth/google/login',
            {},
            baseEnv
        );
        expect(loginRes.status).toBe(302);
        const googleRedirect = new URL(loginRes.headers.get('location'));
        const state = googleRedirect.searchParams.get('state');
        expect(state).toBeTruthy();

        // Reject callback if oauth_state cookie is missing/mismatched
        const badStateRes = await app.request(
            `https://stpaulsleague.joelheath.net/auth/google/callback?code=auth-code&state=wrong`,
            { headers: { Cookie: `oauth_state=${state}` } },
            baseEnv
        );
        expect(badStateRes.status).toBe(400);

        // Step 2: Complete callback with valid state and JWKS-signed id_token
        const callbackRes = await app.request(
            `https://stpaulsleague.joelheath.net/auth/google/callback?code=auth-code&state=${state}`,
            { headers: { Cookie: `oauth_state=${state}` } },
            baseEnv
        );
        expect(callbackRes.status).toBe(302);
        expect(callbackRes.headers.get('location')).toBe('/');
        expect(callbackRes.headers.get('set-cookie')).toMatch(/auth_token=eyJ/);
    });
});
