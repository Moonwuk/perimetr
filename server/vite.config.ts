import {defineConfig} from 'vite';
import {builtinModules} from 'node:module';
import {mkdir, copyFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const project = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(project, 'server/dist');
export default defineConfig({
 resolve: {alias: {'@': project, 'cloudflare:workers': resolve(project, 'server/runtime-env.ts')}},
 ssr: {noExternal: true, external: [...builtinModules, ...builtinModules.map(name => `node:${name}`)]},
 build: {
  ssr: resolve(project, 'server/index.ts'), target: 'node24', outDir: output, emptyOutDir: true,
  sourcemap: false, minify: false,
  rollupOptions: {output: {entryFileNames: 'server.mjs'}},
 },
 plugins: [{name: 'perimeter-sqlite-migrations', async closeBundle() {
  const destination = resolve(output, 'drizzle');
  await mkdir(destination, {recursive: true});
  for (const name of (await readdir(resolve(project, 'drizzle'))).filter(name => name.endsWith('.sql'))) await copyFile(resolve(project, 'drizzle', name), resolve(destination, name));
 }}],
});
