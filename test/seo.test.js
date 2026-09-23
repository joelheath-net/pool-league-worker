import { describe, it, expect } from 'vitest';
import app from '../src/index.js';

describe('SEO and Discovery Tests', () => {
    it('serves robots.txt with correct directives and sitemap URL', async () => {
        const res = await app.request('/robots.txt');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/plain');
        const text = await res.text();
        expect(text).toContain('User-agent: *');
        expect(text).toContain('Allow: /');
        expect(text).toContain('Disallow: /api/');
        expect(text).toContain('Disallow: /admin-panel');
        expect(text).toContain('Sitemap: https://stpaulsleague.joelheath.net/sitemap.xml');
    });

    it('serves sitemap.xml with XML header and canonical routes', async () => {
        const res = await app.request('/sitemap.xml');
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/xml');
        const xml = await res.text();
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<loc>https://stpaulsleague.joelheath.net/</loc>');
        expect(xml).toContain('<loc>https://stpaulsleague.joelheath.net/about</loc>');
        expect(xml).toContain('<loc>https://stpaulsleague.joelheath.net/game-list</loc>');
        expect(xml).toContain('<loc>https://stpaulsleague.joelheath.net/seasons</loc>');
        expect(xml).toContain('<loc>https://stpaulsleague.joelheath.net/archive/all-time</loc>');
    });

    it('performs 301 permanent redirects for legacy aliases', async () => {
        const resArchive = await app.request('/archive');
        expect(resArchive.status).toBe(301);
        expect(resArchive.headers.get('location')).toBe('/seasons');

        const resAllTime = await app.request('/all-time');
        expect(resAllTime.status).toBe(301);
        expect(resAllTime.headers.get('location')).toBe('/archive/all-time');

        const resPrivacy = await app.request('/privacy');
        expect(resPrivacy.status).toBe(301);
        expect(resPrivacy.headers.get('location')).toBe('/privacy-policy');

        const resTerms = await app.request('/terms');
        expect(resTerms.status).toBe(301);
        expect(resTerms.headers.get('location')).toBe('/terms-of-service');
    });

    it('includes canonical, enhanced Open Graph, and JSON-LD in HTML', async () => {
        const res = await app.request('/');
        expect(res.status).toBe(200);
        const html = await res.text();

        // Canonical URL
        expect(html).toContain('<link rel="canonical" href="https://stpaulsleague.joelheath.net/" />');

        // Open Graph
        expect(html).toContain('<meta property="og:url" content="https://stpaulsleague.joelheath.net/" />');
        expect(html).toContain('<meta property="og:site_name" content="St Paul\'s League" />');
        expect(html).toContain('<meta property="og:locale" content="en_GB" />');
        expect(html).toContain('<meta property="og:image:width" content="640" />');
        expect(html).toContain('<meta property="og:image:height" content="640" />');
        expect(html).toContain('<meta property="og:image:alt" content="St Paul\'s Pool League Logo" />');

        // Twitter Card
        expect(html).toContain('<meta name="twitter:card" content="summary" />');
        expect(html).toContain('<meta name="twitter:image:alt" content="St Paul\'s Pool League Logo" />');

        // Schema.org JSON-LD
        expect(html).toContain('"@type": "SportsOrganization"');
        expect(html).toContain('"name": "St Paul\'s League"');
        expect(html).toContain('"sport": "8-Ball Pool"');
        expect(html).toContain('"sameAs"');
        expect(html).toContain('https://www.instagram.com/stpaulsleague/');
        expect(html).toContain('"@type": "WebSite"');

        // Keywords tag removed
        expect(html).not.toContain('<meta name="keywords"');

        // Table header scope="col"
        expect(html).toContain('<th scope="col" class="sticky"');
    });

    it('returns a styled 404 page with noindex for unknown routes', async () => {
        const res = await app.request('/does-not-exist');
        expect(res.status).toBe(404);
        const html = await res.text();
        expect(html).toContain('Page Not Found');
        expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
        expect(html).toContain('Return to Standings');
    });

    it('renders the monochrome Instagram logo button in the header', async () => {
        const res = await app.request('/');
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('href="https://www.instagram.com/stpaulsleague/"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain('class="instagram-btn"');
        expect(html).toContain('<svg');
        expect(html).toContain('fill="currentColor"');
    });
});
