import {cp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'server/releases'),name='perimeter-server-0.5.0',staging=join(output,name);
await mkdir(output,{recursive:true});
await rm(staging,{recursive:true,force:true});
await mkdir(staging);
await cp(join(root,'server/dist'),staging,{recursive:true});
await mkdir(join(staging,'deploy'));
for(const entry of await readdir(join(root,'server/deploy'),{withFileTypes:true})){
 if(!entry.isFile())continue;
 if(!['Dockerfile','Dockerfile.dockerignore','Caddyfile','env.example','.dockerignore'].includes(entry.name)&&!/^[-\w]+\.(sh|mjs|yml|yaml|md)$/.test(entry.name))continue;
 await cp(join(root,'server/deploy',entry.name),join(staging,'deploy',entry.name));
}
await cp(join(root,'server/README.md'),join(staging,'README.md'));
await cp(join(root,'server/VERIFICATION.md'),join(staging,'VERIFICATION.md'));
await writeFile(join(staging,'BUILD.json'),JSON.stringify({game:'perimeter',version:'0.5.0',runtime:'Node.js 24',builtAt:new Date().toISOString(),nodeVersion:process.versions.node},null,2)+'\n');
const lines=[];
async function hashes(directory){
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const path=join(directory,entry.name);
  if(entry.isSymbolicLink())throw new Error('Unexpected symlink in package');
  if(entry.isDirectory())await hashes(path);
  else lines.push(createHash('sha256').update(await readFile(path)).digest('hex')+'  '+relative(staging,path));
 }
}
await hashes(staging);
await writeFile(join(staging,'SHA256SUMS.txt'),lines.join('\n')+'\n');
const archive=join(output,name+'.tar.gz');
const result=spawnSync('tar',['-czf',archive,'-C',output,name],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
const digest=createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(archive+'.sha256',`${digest}  ${name}.tar.gz\n`);
console.log(`Ready: ${archive}\nSHA256 ${digest}`);
