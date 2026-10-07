import {readFileSync} from 'node:fs';
import {publicationErrors} from './android-publication-config.mjs';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const config=JSON.parse(read('../mobile/config.json'));
const gradle=read('../android/app/build.gradle');
const version=gradle.match(/versionName '([^']+)'/)?.[1];
const code=Number(gradle.match(/versionCode (\d+)/)?.[1]);
const listing=JSON.parse(read(`../release/rustore/${version}/store-listing.json`));
const errors=publicationErrors({...listing,...config});
if(listing.onlineOrigin!==config.onlineOrigin||listing.privacyPolicyUrl!==config.privacyPolicyUrl)errors.push('Store metadata must match the mobile server and privacy URLs.');
if(listing.packageName!=='ru.moongametechnology.perimeter')errors.push('The package name must retain compatibility with the existing game.');
if(listing.versionName!==version||listing.versionCode!==code)errors.push('Store and Android versions must match.');
for(const [key,max] of [['name',30],['shortDescription',80],['fullDescription',4000]])if(typeof listing[key]!=='string'||!listing[key].trim()||listing[key].length>max)errors.push(`Invalid ${key} (maximum ${max} characters).`);
if(errors.length){console.error('Android publication configuration is incomplete:\n'+errors.map(x=>' - '+x).join('\n'));process.exitCode=1;}
else console.log(`Android ${version} publication configuration checked. Device tests and RuStore moderation remain separate.`);
