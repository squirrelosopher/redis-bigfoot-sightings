import { build } from 'esbuild';
import path from 'path';
import fs from 'fs';

const TRANSPILE_DIR = './view_scripts';
const isDev = process.env.NODE_ENV === 'development';

let transpileFiles = [];
fs.readdirSync(TRANSPILE_DIR).forEach(file => {
    const filePath = path.resolve(TRANSPILE_DIR, file);
    transpileFiles.push(filePath);
});

build({
    entryPoints: transpileFiles,
    outdir: 'public/scripts/dist/',
    bundle: true,
    sourcemap: isDev,
    minify: !isDev,
    splitting: true,
    platform: 'node',
    format: 'esm',
    target: ['esnext'],
})
    .catch((e) => {
        console.error(`unable to transpile ${TRANSPILE_DIR}, reason: ${e.message}`);
        process.exit(1);
    })
    .then(() => console.log(`[profile: ${process.env.NODE_ENV}] successfully transpiled ${transpileFiles.length} file(s) from ${TRANSPILE_DIR}`));