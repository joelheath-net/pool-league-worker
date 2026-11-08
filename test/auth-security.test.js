import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sign } from 'hono/jwt';
import fullApp from '../src/index.js';
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
    whitelistedEmails = ['admin@example.com', 'player@example.com', 'spectator@example.com'],
    deletedPushForUsers = []
} = {}) {
    const whitelistSet = new Set(whitelistedEmails.map((e) => e.toLowerCase()));
    const queryCounts = {
        accessFlags: 0
    };

    return {
        deletedPushForUsers,
        queryCounts,
        prepare(sql) {
            return {
                bind(...params) {
                    return {
                        async first() {
                            if (sql.includes('FROM whitelisted_emails')) {
                                const email = String(params[0] || '').toLowerCase();
                                return whitelistSet.has(email) ? { email } : null;
                            }
                            if (sql.includes('SELECT role, participating FROM users WHERE id = ?')) {
                                queryCounts.accessFlags += 1;
                                const user = users[params[0]];
                                return user
                                    ? {
                                          role: user.role,
                                          participating: user.participating ?? 1
                                      }
                                    : null;
                            }
                            if (sql.includes('SELECT id, email, google_refresh_token FROM users')) {
                                const user = users[params[0]];
                                return user
                                    ? {
                                          id: user.id,
                                          email: user.email,
                                          google_refresh_token: user.google_refresh_token
                                      }
                                    : null;
                            }
                            if (sql.includes('SELECT id, name, email FROM users')) {
                                const user = users[params[0]];
                                return user
                                    ? {
                                          id: user.id,
                                          name: user.name,
                                          email: user.email
                                      }
                                    : null;
                            }
                            if (sql.includes('SELECT id, name, team, team_color, participating FROM users WHERE id = ?')) {
                                const user = users[params[0]];
                                return user
                                    ? {
                                          id: user.id,
                                          name: user.name,
                                          team: user.team || 'My Team',
                                          team_color: user.team_color || '#ffffff',
                                          participating: user.participating ?? 1
                                      }
                                    : null;
                            }
                            if (sql.includes('SELECT id FROM users WHERE id = ?')) {
                                const user = users[params[0]];
                                return user ? { id: user.id } : null;
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
                                    participating: 1,
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
                    if (sql.includes('FROM game_revisions')) {
                        return { results: [] };
                    }
                    return { results: [] };
                }
            };
        }
    };
}

describe('JWT, Roles & Auth Security', () => {
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
                participating: 1,
                google_refresh_token: 'valid-google-refresh-token-admin'
            },
            'player-google-sub-456': {
                id: 'player-google-sub-456',
                name: 'Friend',
                email: 'player@example.com',
                role: 'user',
                participating: 1,
                google_refresh_token: 'valid-google-refresh-token-player'
            },
            'spectator-google-sub-789': {
                id: 'spectator-google-sub-789',
                name: 'BenchPlayer',
                email: 'spectator@example.com',
                role: 'user',
                participating: 0,
                google_refresh_token: 'valid-google-refresh-token-spectator'
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

    it('DOES NOT store role or participating claims inside the signed access token cookie', async () => {
        const { payload } = await signAuthToken(
            { id: 'admin-google-sub-123', email: 'admin@example.com', role: 'admin', participating: true },
            baseEnv
        );

        expect(payload.sub).toBe('admin-google-sub-123');
        expect(payload.email).toBe('admin@example.com');
        expect(payload.role).toBeUndefined();
        expect(payload.participating).toBeUndefined();
    });

    it('SERVES authenticated API routes using only JWT verification (zero role/participation DB lookups)', async () => {
        const { jwt: spectatorJwt } = await signAuthToken(
            { id: 'spectator-google-sub-789', email: 'spectator@example.com' },
            baseEnv
        );

        const auditRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/auth/audit-log',
            { headers: { Cookie: `auth_token=${spectatorJwt}` } },
            baseEnv
        );
        expect(auditRes.status).toBe(200);
        expect(baseEnv.DB.queryCounts.accessFlags).toBe(0);

        const profileRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/auth/profile',
            { headers: { Cookie: `auth_token=${spectatorJwt}` } },
            baseEnv
        );
        expect(profileRes.status).toBe(200);
        expect(baseEnv.DB.queryCounts.accessFlags).toBe(0);
    });

    it('REVOKES admin access immediately on DB role change without waiting for token expiry', async () => {
        const { jwt: adminJwt } = await signAuthToken(
            { id: 'admin-google-sub-123', email: 'admin@example.com' },
            baseEnv
        );

        // Initially admin in DB -> allowed
        const initialApiRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${adminJwt}` } },
            baseEnv
        );
        expect(initialApiRes.status).toBe(200);

        const initialWebRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${adminJwt}` } },
            baseEnv
        );
        expect(initialWebRes.status).toBe(200);

        // Demote admin in DB -> same unexpired cookie is immediately blocked
        mockUsers['admin-google-sub-123'].role = 'user';

        const revokedApiRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${adminJwt}` } },
            baseEnv
        );
        expect(revokedApiRes.status).toBe(403);

        const revokedWebRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${adminJwt}` } },
            baseEnv
        );
        expect(revokedWebRes.status).toBe(302);
        expect(revokedWebRes.headers.get('location')).toBe('/');

        // Even if an old token had role: 'admin' baked into the JWT payload, DB role='user' wins
        const legacyRoleJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                role: 'admin',
                exp: Math.floor(Date.now() / 1000) + 900
            },
            REAL_SECRET,
            'HS256'
        );
        const legacyRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${legacyRoleJwt}` } },
            baseEnv
        );
        expect(legacyRes.status).toBe(403);
    });

    it('RESTRICTS game recording and editing to participating players only (even for non-participating admins)', async () => {
        const { jwt: spectatorJwt } = await signAuthToken(
            { id: 'spectator-google-sub-789', email: 'spectator@example.com' },
            baseEnv
        );

        // Non-participating player can access profile & audit-log web pages
        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/audit-log',
                { headers: { Cookie: `auth_token=${spectatorJwt}` } },
                baseEnv
            )).status
        ).toBe(200);
        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/profile',
                { headers: { Cookie: `auth_token=${spectatorJwt}` } },
                baseEnv
            )).status
        ).toBe(200);

        // Non-participating player is redirected away from /log-game and /edit-game
        const logWebRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/log-game',
            { headers: { Cookie: `auth_token=${spectatorJwt}` } },
            baseEnv
        );
        expect(logWebRes.status).toBe(302);
        expect(logWebRes.headers.get('location')).toBe('/');

        const editWebRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/edit-game',
            { headers: { Cookie: `auth_token=${spectatorJwt}` } },
            baseEnv
        );
        expect(editWebRes.status).toBe(302);
        expect(editWebRes.headers.get('location')).toBe('/');

        // Non-participating player gets 403 on all participating API endpoints
        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${spectatorJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                },
                baseEnv
            )).status
        ).toBe(403);

        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/api/participating/log-game',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${spectatorJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                },
                baseEnv
            )).status
        ).toBe(403);

        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/api/participating/games/1',
                { headers: { Cookie: `auth_token=${spectatorJwt}` } },
                baseEnv
            )).status
        ).toBe(403);

        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/api/participating/games/1',
                {
                    method: 'PATCH',
                    headers: { Cookie: `auth_token=${spectatorJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                },
                baseEnv
            )).status
        ).toBe(403);

        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/api/participating/games/1',
                {
                    method: 'DELETE',
                    headers: { Cookie: `auth_token=${spectatorJwt}` }
                },
                baseEnv
            )).status
        ).toBe(403);

        // Non-participating ADMIN is also blocked from recording/editing games while still allowed into /admin-panel
        mockUsers['admin-google-sub-123'].participating = 0;
        const { jwt: nonPartAdminJwt } = await signAuthToken(
            { id: 'admin-google-sub-123', email: 'admin@example.com' },
            baseEnv
        );

        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/api/participating/games',
                {
                    method: 'POST',
                    headers: { Cookie: `auth_token=${nonPartAdminJwt}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                },
                baseEnv
            )).status
        ).toBe(403);
        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/log-game',
                { headers: { Cookie: `auth_token=${nonPartAdminJwt}` } },
                baseEnv
            )).status
        ).toBe(302);
        expect(
            (await fullApp.request(
                'https://stpaulsleague.joelheath.net/admin-panel',
                { headers: { Cookie: `auth_token=${nonPartAdminJwt}` } },
                baseEnv
            )).status
        ).toBe(200);
    });

    it('HIDES record/edit game links in HTML UI for authenticated non-participating players while keeping profile & audit log links', async () => {
        const { jwt: spectatorJwt } = await signAuthToken(
            { id: 'spectator-google-sub-789', email: 'spectator@example.com' },
            baseEnv
        );
        const { jwt: playerJwt } = await signAuthToken(
            { id: 'player-google-sub-456', email: 'player@example.com' },
            baseEnv
        );

        // 1. Non-participating player on /game-list
        const specGameListHtml = await (
            await fullApp.request(
                'https://stpaulsleague.joelheath.net/game-list',
                { headers: { Cookie: `auth_token=${spectatorJwt}` } },
                baseEnv
            )
        ).text();
        expect(specGameListHtml).not.toContain('href="/log-game"');
        expect(specGameListHtml).not.toContain('href="/admin-panel"');
        expect(specGameListHtml).toContain('href="/profile"');
        expect(specGameListHtml).toContain('href="/audit-log"');
        expect(specGameListHtml).not.toContain('<div class="table-cell">Edit</div>');
        expect(specGameListHtml).toContain('data-is-participating="false"');

        // 2. Non-participating player on /outstanding-games
        const specOutstandingHtml = await (
            await fullApp.request(
                'https://stpaulsleague.joelheath.net/outstanding-games',
                { headers: { Cookie: `auth_token=${spectatorJwt}` } },
                baseEnv
            )
        ).text();
        expect(specOutstandingHtml).not.toContain('href="/log-game"');
        expect(specOutstandingHtml).not.toContain('<div class="table-cell">Log Game</div>');
        expect(specOutstandingHtml).toContain('data-is-participating="false"');

        // 3. Participating player on /game-list & /outstanding-games
        const partGameListHtml = await (
            await fullApp.request(
                'https://stpaulsleague.joelheath.net/game-list',
                { headers: { Cookie: `auth_token=${playerJwt}` } },
                baseEnv
            )
        ).text();
        expect(partGameListHtml).toContain('href="/log-game"');
        expect(partGameListHtml).toContain('href="/audit-log"');
        expect(partGameListHtml).toContain('<div class="table-cell">Edit</div>');
        expect(partGameListHtml).toContain('data-is-participating="true"');

        const partOutstandingHtml = await (
            await fullApp.request(
                'https://stpaulsleague.joelheath.net/outstanding-games',
                { headers: { Cookie: `auth_token=${playerJwt}` } },
                baseEnv
            )
        ).text();
        expect(partOutstandingHtml).toContain('<div class="table-cell">Log Game</div>');
        expect(partOutstandingHtml).toContain('data-is-participating="true"');
    });

    it('BLOCKS forged expired JWT with admin sub from triggering server-side refresh or accessing admin routes', async () => {
        const forgedExpiredJwt = `${toBase64Url({ alg: 'HS256', typ: 'JWT' })}.${toBase64Url({
            sub: 'admin-google-sub-123',
            exp: 1
        })}.forged_signature_bytes`;

        const adminWebRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${forgedExpiredJwt}` } },
            baseEnv
        );
        expect(adminWebRes.status).toBe(302);
        expect(adminWebRes.headers.get('location')).toBe('/');
        expect(adminWebRes.headers.get('set-cookie')).toContain('auth_token=;');
        expect(globalThis.fetch).not.toHaveBeenCalled();

        const adminApiRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${forgedExpiredJwt}` } },
            baseEnv
        );
        expect(adminApiRes.status).toBe(401);
        expect(globalThis.fetch).not.toHaveBeenCalled();

        const logGameRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/participating/log-game',
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
        const wrongSecretJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                exp: Math.floor(Date.now() / 1000) + 900
            },
            ATTACKER_SECRET,
            'HS256'
        );

        const res = await fullApp.request(
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
        const algNoneToken = `${toBase64Url({ alg: 'none', typ: 'JWT' })}.${toBase64Url({
            sub: 'admin-google-sub-123',
            exp: Math.floor(Date.now() / 1000) + 900
        })}.`;

        const algNoneRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${algNoneToken}` } },
            baseEnv
        );
        expect(algNoneRes.status).toBe(401);

        // Legitimately signed non-admin user token
        const { jwt: validPlayerJwt } = await signAuthToken(
            { id: 'player-google-sub-456', email: 'player@example.com' },
            baseEnv
        );

        // Non-admin user gets 403 on admin endpoints
        const nonAdminRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${validPlayerJwt}` } },
            baseEnv
        );
        expect(nonAdminRes.status).toBe(403);

        // Tamper the payload of validPlayerJwt to swap sub to admin while keeping original signature
        const [headerPart, , sigPart] = validPlayerJwt.split('.');
        const tamperedJwt = `${headerPart}.${toBase64Url({
            sub: 'admin-google-sub-123',
            email: 'admin@example.com',
            exp: Math.floor(Date.now() / 1000) + 900
        })}.${sigPart}`;

        const tamperedRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${tamperedJwt}` } },
            baseEnv
        );
        expect(tamperedRes.status).toBe(401);
    });

    it('BLOCKS forged JWT on GET /auth/logout from wiping another user push subscriptions', async () => {
        const forgedLogoutJwt = `${toBase64Url({ alg: 'HS256', typ: 'JWT' })}.${toBase64Url({
            sub: 'admin-google-sub-123',
            exp: Math.floor(Date.now() / 1000) + 900
        })}.forged`;

        const res = await fullApp.request(
            'https://stpaulsleague.joelheath.net/auth/logout',
            { headers: { Cookie: `auth_token=${forgedLogoutJwt}` } },
            baseEnv
        );

        expect(res.status).toBe(302);
        expect(baseEnv.DB.deletedPushForUsers).toEqual([]);
    });

    it('ALLOWS valid server-signed expired JWT (within 90d window) to refresh seamlessly', async () => {
        const now = Math.floor(Date.now() / 1000);

        const genuinelySignedExpiredAdminJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                iat: now - accessTokenExpiresIn - 60,
                exp: now - 60
            },
            REAL_SECRET,
            'HS256'
        );

        const res = await fullApp.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${genuinelySignedExpiredAdminJwt}` } },
            baseEnv
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toContain('Admin Panel');
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(res.headers.get('set-cookie')).toMatch(/auth_token=eyJ/);
    });

    it('REJECTS refresh when expired token exceeds 90-day refresh lifetime or email is removed from whitelist', async () => {
        const now = Math.floor(Date.now() / 1000);

        // 1. Beyond 90-day refresh window
        const ancientSignedJwt = await sign(
            {
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                iat: now - refreshTokenExpiresIn - 100,
                exp: now - refreshTokenExpiresIn + accessTokenExpiresIn - 100
            },
            REAL_SECRET,
            'HS256'
        );

        const ancientRes = await fullApp.request(
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
                iat: now - accessTokenExpiresIn - 10,
                exp: now - 10
            },
            REAL_SECRET,
            'HS256'
        );

        const unwhitelistedRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/admin-panel',
            { headers: { Cookie: `auth_token=${recentlyExpiredJwt}` } },
            unwhitelistedEnv
        );
        expect(unwhitelistedRes.status).toBe(302);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('INVALIDATES all active and expired JWTs immediately when JWT_SECRET is rotated', async () => {
        const { jwt: oldValidAdminJwt } = await signAuthToken(
            { id: 'admin-google-sub-123', email: 'admin@example.com' },
            baseEnv
        );

        const rotatedEnv = {
            ...baseEnv,
            JWT_SECRET: 'brand-new-rotated-production-secret-9876543210'
        };

        const res = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${oldValidAdminJwt}` } },
            rotatedEnv
        );
        expect(res.status).toBe(401);
        expect(res.headers.get('set-cookie')).toContain('auth_token=;');
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('VERIFIES OAuth state and Google ID token OIDC claims in /auth/google/callback (and handles any JWT_SECRET format)', async () => {
        const trickyEnv = {
            ...baseEnv,
            JWT_SECRET: 'random+PRIVATE+looking/base64/secret==\n'
        };

        const idTokenFromGoogleTokenEndpoint = await sign(
            {
                iss: 'https://accounts.google.com',
                aud: trickyEnv.GOOGLE_CLIENT_ID,
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                email_verified: true,
                name: 'Joel',
                exp: Math.floor(Date.now() / 1000) + 3600
            },
            'google-token-endpoint-mock-sig',
            'HS256'
        );

        globalThis.fetch = vi.fn(async (url) => {
            if (String(url) === 'https://oauth2.googleapis.com/token') {
                return new Response(
                    JSON.stringify({
                        access_token: 'google-access-token',
                        refresh_token: 'google-refresh-token',
                        expires_in: 3600,
                        id_token: idTokenFromGoogleTokenEndpoint
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
            throw new Error(`Unexpected fetch to ${url}`);
        });

        // Step 1: Start login and get oauth_state cookie
        const loginRes = await fullApp.request(
            'https://stpaulsleague.joelheath.net/auth/google/login',
            {},
            trickyEnv
        );
        expect(loginRes.status).toBe(302);
        const googleRedirect = new URL(loginRes.headers.get('location'));
        const state = googleRedirect.searchParams.get('state');
        expect(state).toBeTruthy();

        // Reject callback if oauth_state cookie is missing/mismatched
        const badStateRes = await fullApp.request(
            `https://stpaulsleague.joelheath.net/auth/google/callback?code=auth-code&state=wrong`,
            { headers: { Cookie: `oauth_state=${state}` } },
            trickyEnv
        );
        expect(badStateRes.status).toBe(400);

        // Step 2: Complete callback with valid state and Google token-endpoint id_token
        const callbackRes = await fullApp.request(
            `https://stpaulsleague.joelheath.net/auth/google/callback?code=auth-code&state=${state}`,
            { headers: { Cookie: `oauth_state=${state}` } },
            trickyEnv
        );
        expect(callbackRes.status).toBe(302);
        expect(callbackRes.headers.get('location')).toBe('/');
        const setCookieHeader = callbackRes.headers.get('set-cookie') || '';
        const match = setCookieHeader.match(/auth_token=([^;]+)/);
        expect(match).toBeTruthy();

        // Step 3: Verify the issued auth_token works on subsequent admin requests
        const adminCheck = await fullApp.request(
            'https://stpaulsleague.joelheath.net/api/admin/whitelist',
            { headers: { Cookie: `auth_token=${match[1]}` } },
            trickyEnv
        );
        expect(adminCheck.status).toBe(200);
    });

    it('SUPPORTS return_to redirect for the mobile worker while keeping / for main site and blocking untrusted domains', async () => {
        const idTokenFromGoogleTokenEndpoint = await sign(
            {
                iss: 'https://accounts.google.com',
                aud: baseEnv.GOOGLE_CLIENT_ID,
                sub: 'admin-google-sub-123',
                email: 'admin@example.com',
                email_verified: true,
                name: 'Joel',
                exp: Math.floor(Date.now() / 1000) + 3600
            },
            'google-token-endpoint-mock-sig',
            'HS256'
        );

        globalThis.fetch = vi.fn(async (url) => {
            if (String(url) === 'https://oauth2.googleapis.com/token') {
                return new Response(
                    JSON.stringify({
                        access_token: 'google-access-token',
                        refresh_token: 'google-refresh-token',
                        expires_in: 3600,
                        id_token: idTokenFromGoogleTokenEndpoint
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
            throw new Error(`Unexpected fetch to ${url}`);
        });

        // 1. Mobile login with valid return_to
        const mobileReturnTo = 'https://mobile.stpaulsleague.joelheath.net/auth/token-callback';
        const loginRes = await fullApp.request(
            `https://stpaulsleague.joelheath.net/auth/google/login?return_to=${encodeURIComponent(mobileReturnTo)}`,
            {},
            baseEnv
        );
        expect(loginRes.status).toBe(302);
        const state = new URL(loginRes.headers.get('location')).searchParams.get('state');

        const callbackRes = await fullApp.request(
            `https://stpaulsleague.joelheath.net/auth/google/callback?code=auth-code&state=${state}`,
            {
                headers: {
                    Cookie: `oauth_state=${state}; oauth_return_to=${encodeURIComponent(mobileReturnTo)}`
                }
            },
            baseEnv
        );
        expect(callbackRes.status).toBe(302);
        const redirectUrl = new URL(callbackRes.headers.get('location'));
        expect(redirectUrl.origin).toBe('https://mobile.stpaulsleague.joelheath.net');
        expect(redirectUrl.pathname).toBe('/auth/token-callback');
        expect(redirectUrl.searchParams.get('token')).toMatch(/^eyJ/);

        // 2. Untrusted return_to domain is rejected and falls back to /
        const evilReturnTo = 'https://evil-attacker.example.com/auth/token-callback';
        const evilCallbackRes = await fullApp.request(
            `https://stpaulsleague.joelheath.net/auth/google/callback?code=auth-code&state=${state}`,
            {
                headers: {
                    Cookie: `oauth_state=${state}; oauth_return_to=${encodeURIComponent(evilReturnTo)}`
                }
            },
            baseEnv
        );
        expect(evilCallbackRes.status).toBe(302);
        expect(evilCallbackRes.headers.get('location')).toBe('/');
    });
});
