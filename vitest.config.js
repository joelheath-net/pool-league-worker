import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	esbuild: {
		jsx: 'automatic',
		jsxImportSource: 'hono/jsx',
		loader: 'jsx',
		include: /.*\.[jt]sx?$/,
		exclude: [],
	},
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
});
