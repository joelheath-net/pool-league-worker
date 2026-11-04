import { defineConfig } from 'vitest/config';

export default defineConfig({
    esbuild: {
        loader: 'jsx',
        include: /(src|views|test)\/.*\.jsx?$/,
        exclude: [],
        jsx: 'automatic',
        jsxImportSource: 'hono/jsx'
    }
});
