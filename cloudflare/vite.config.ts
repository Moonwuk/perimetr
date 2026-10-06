import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('..',import.meta.url));
export default defineConfig({
 root:fileURLToPath(new URL('./web',import.meta.url)),
 plugins:[react()],
 server:{host:'0.0.0.0',allowedHosts:['terminal.local'],proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:true,headers:{Origin:'http://127.0.0.1:8787'}}}},
 resolve:{alias:{'@':project}},
 css:{postcss:project},
 build:{target:'chrome111',outDir:fileURLToPath(new URL('./dist',import.meta.url)),emptyOutDir:true,sourcemap:false},
});
