import {readFile,writeFile} from 'node:fs/promises';

const id=process.argv[2]||process.env.PERIMETER_D1_DATABASE_ID;
if(!id||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i).test(id)||/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)){
 console.error('Передайте настоящий database_id: pnpm cf:configure <UUID из wrangler d1 create>.');process.exit(1);
}
const file=new URL('../wrangler.json',import.meta.url);
const config=JSON.parse(await readFile(file,'utf8'));
config.d1_databases[0].database_id=id;
await writeFile(file,JSON.stringify(config,null,2)+'\n');
console.log('D1 database_id сохранён. Теперь: pnpm cf:deploy');
