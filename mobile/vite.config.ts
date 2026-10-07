import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';

const root=fileURLToPath(new URL('..',import.meta.url));
const config=JSON.parse(readFileSync(new URL('./config.json',import.meta.url),'utf8'));
const origin=config.onlineOrigin||'';
const policy=config.privacyPolicyUrl||'';
const gradle=readFileSync(new URL('../android/app/build.gradle',import.meta.url),'utf8');
const versionName=gradle.match(/versionName '([^']+)'/)?.[1];
const versionCode=Number(gradle.match(/versionCode (\d+)/)?.[1]);
if(!versionName||!versionCode)throw new Error('Android version is missing');
if(origin && (new URL(origin).protocol!=='https:' || new URL(origin).origin!==origin || new URL(origin).port))throw new Error('onlineOrigin must be a bare HTTPS origin on port 443');
if(policy && (new URL(policy).protocol!=='https:' || new URL(policy).username || new URL(policy).password))throw new Error('privacyPolicyUrl must be a public HTTPS URL');
export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)),
  base:'./',
  plugins:[react(),{name:'mobile-csp',transformIndexHtml(html){return origin?html.replace("connect-src 'self'",`connect-src 'self' ${origin}`):html;},generateBundle(){this.emitFile({type:'asset',fileName:'perimeter-build.json',source:JSON.stringify({onlineOrigin:origin,privacyPolicyUrl:policy,versionName,versionCode})});}}],
  resolve:{alias:{'@':root}},
  define:{'globalThis.__PERIMETER_ONLINE_ORIGIN__':JSON.stringify(origin),'globalThis.__PERIMETER_PRIVACY_URL__':JSON.stringify(policy)},
  css:{postcss:root},
  build:{target:'chrome111',outDir:`${root}/android/app/src/main/assets/web`,emptyOutDir:true,sourcemap:false},
});
