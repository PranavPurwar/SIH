import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

console.log('🚀 [1/5] Running TypeScript type checks...');
const typecheck = spawnSync('bun', ['run', 'typecheck'], { stdio: 'inherit' });
if (typecheck.status !== 0) {
  console.error('❌ Typecheck failed');
  process.exit(1);
}

console.log('📦 [2/5] Preparing vendor assets in public/vendor...');
fs.mkdirSync(path.join(rootDir, 'public/vendor'), { recursive: true });
fs.mkdirSync(path.join(rootDir, 'public/dist'), { recursive: true });

fs.copyFileSync(
  path.join(rootDir, 'node_modules/vue/dist/vue.global.prod.js'),
  path.join(rootDir, 'public/vendor/vue.global.prod.js')
);
fs.copyFileSync(
  path.join(rootDir, 'node_modules/chart.js/dist/chart.umd.min.js'),
  path.join(rootDir, 'public/vendor/chart.umd.min.js')
);

console.log('🎨 [3/5] Compiling and minifying production Tailwind CSS...');
const tailwind = spawnSync('bun', [
  'run',
  './node_modules/.bin/tailwindcss',
  '-i',
  'src/client/css/main.css',
  '-o',
  'public/dist/style.min.css',
  '--minify'
], { stdio: 'inherit' });

if (tailwind.status !== 0) {
  console.error('❌ Tailwind build failed');
  process.exit(1);
}

console.log('⚡ [4/5] Bundling & minifying client SPA bundle...');
const clientBuild = spawnSync('bun', [
  'build',
  'src/client/app.ts',
  '--target=browser',
  '--minify',
  '--outfile=public/dist/app.min.js'
], { stdio: 'inherit' });

if (clientBuild.status !== 0) {
  console.error('❌ Client bundle failed');
  process.exit(1);
}

console.log('⚙️  [5/5] Bundling & minifying server entrypoint (dist/index.js)...');
const serverBuild = spawnSync('bun', [
  'build',
  'src/index.ts',
  '--target=node',
  '--packages=external',
  '--minify',
  '--outfile=dist/index.js'
], { stdio: 'inherit' });

if (serverBuild.status !== 0) {
  console.error('❌ Server build failed');
  process.exit(1);
}

console.log('✅ Production build completed successfully!');
