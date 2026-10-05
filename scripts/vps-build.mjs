import {spawnSync} from 'node:child_process';
import {cp,readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

if(Number(process.versions.node.split('.')[0])<24)throw new Error('VPS build requires Node.js 24 or newer.');
const root=fileURLToPath(new URL('../',import.meta.url));
const vite=fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url));
for(const config of ['cloudflare/vite.config.ts','server/vite.config.ts']){
 const result=spawnSync(process.execPath,[vite,'build','--config',config],{cwd:root,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
await cp(new URL('../cloudflare/dist/',import.meta.url),new URL('../server/dist/public/',import.meta.url),{recursive:true});
for(const path of ['server.mjs','public/index.html']){
 await stat(new URL('../server/dist/'+path,import.meta.url));
}
const bundle=await readFile(new URL('../server/dist/server.mjs',import.meta.url),'utf8');
if(bundle.includes('from "cloudflare:workers"')||bundle.includes("from 'cloudflare:workers'"))throw new Error('Cloudflare runtime import was not bundled.');
console.log('VPS build ready: server/dist (Node.js 24, bundled frontend and migrations).');
