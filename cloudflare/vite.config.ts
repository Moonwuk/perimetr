import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('..',import.meta.url));
export default defineConfig({
 root:fileURLToPath(new URL('./web',import.meta.url)),
 plugins:[react()],
 resolve:{alias:{'@':project}},
 css:{postcss:project},
 build:{target:'chrome111',outDir:fileURLToPath(new URL('./dist',import.meta.url)),emptyOutDir:true,sourcemap:false},
});
