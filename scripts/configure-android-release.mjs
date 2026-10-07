import {readFileSync, writeFileSync} from 'node:fs';
import {publicationErrors} from './android-publication-config.mjs';

// Public publication metadata only. Signing material is never read or written here.
try {
  const input = JSON.parse(readFileSync(process.argv[2] || 0, 'utf8'));
  const errors = publicationErrors(input);
  if (errors.length) throw new Error(errors.join('\n'));
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const versionName = gradle.match(/versionName '([^']+)'/)[1];
  const versionCode = Number(gradle.match(/versionCode (\d+)/)[1]);
  const listingPath = new URL(`../release/rustore/${versionName}/store-listing.json`, import.meta.url);
  const listing = JSON.parse(readFileSync(listingPath, 'utf8'));
  for (const key of ['onlineOrigin', 'privacyPolicyUrl', 'supportContact', 'dataControllerName', 'ageRating']) listing[key] = input[key];
  Object.assign(listing, {versionName, versionCode, status: 'configured-not-device-tested', publicationNote: 'Публичные параметры настроены. До модерации проверить подписанный APK на устройствах, сетевой матч и декларацию данных; приложить актуальные скриншоты.'});
  writeFileSync(new URL('../mobile/config.json', import.meta.url), JSON.stringify({onlineOrigin: input.onlineOrigin, privacyPolicyUrl: input.privacyPolicyUrl}, null, 2) + '\n');
  writeFileSync(listingPath, JSON.stringify(listing, null, 2) + '\n');
  console.log(`Android ${versionName}/${versionCode}: конфиг приложения и карточки синхронизирован. Теперь pnpm android:check и pnpm android:release.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
