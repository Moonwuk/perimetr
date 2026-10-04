import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const root=fileURLToPath(new URL('..',import.meta.url));
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url),'utf8'));
const origin=config.onlineOrigin||'';
if(origin && (new URL(origin).protocol!=='https:' || new URL(origin).origin!==origin))throw new Error('onlineOrigin must be a bare HTTPS origin');
export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)),
  base:'./',
  plugins:[react(),{name:'mobile-csp',transformIndexHtml(html){return origin?html.replace("connect-src 'self'",`connect-src 'self' ${origin}`):html;}}],
  resolve:{alias:{'@':root}},
  define:{'globalThis.__PERIMETER_ONLINE_ORIGIN__':JSON.stringify(origin)},
  css:{postcss:root},
  build:{target:'chrome111',outDir:`${root}/android/app/src/main/assets/web`,emptyOutDir:true,sourcemap:false},
});
