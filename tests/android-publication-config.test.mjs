import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationErrors} from '../scripts/android-publication-config.mjs';

const configured = {onlineOrigin: 'https://game.moongametechnology.ru', privacyPolicyUrl: 'https://game.moongametechnology.ru/privacy.html', supportContact: 'support@moongametechnology.ru', dataControllerName: 'Тестовый оператор', ageRating: '12+'};
test('online publication requires a public endpoint, policy, contact, owner and a completed rating', () => {
  assert.deepEqual(publicationErrors(configured), []);
  assert.deepEqual(publicationErrors({...configured, supportContact: 'https://moongametechnology.ru/support'}), []);
  assert.equal(publicationErrors({}).length, 5);
  for (const value of ['http://game.moongametechnology.ru', 'https://localhost', 'https://127.0.0.1', 'https://192.168.1.1', 'https://[::1]', 'https://game.example', 'https://example.com', 'https://game.moongametechnology.ru/', 'https://game.moongametechnology.ru/api', 'https://user:secret@game.moongametechnology.ru', 'https://game.moongametechnology.ru:444']) assert.ok(publicationErrors({...configured, onlineOrigin: value}).some(e => e.startsWith('onlineOrigin:')), value);
  for (const [key, value] of [['privacyPolicyUrl', 'https://localhost/privacy'], ['supportContact', '[EMAIL]'], ['dataControllerName', 'TODO'], ['ageRating', '3+']]) assert.ok(publicationErrors({...configured, [key]: value}).some(e => e.startsWith(key + ':')), key);
});
