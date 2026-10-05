# Android / RuStore

Нативная Java-оболочка содержит автономную сборку React-игры. Код движка общий с веб-версией; игровые файлы включены в APK. Исходники следующей сборки: `0.5.0`, `versionCode=500`; готовые подписанные APK/AAB в репозитории пока относятся к `0.4.1` и не содержат новых правил. Package ID: `ru.moongametechnology.perimeter`, Android 8.0+ (API 26), target/compile API 36. Нужен актуальный Android System WebView с Chromium 111+.

## Локальная сборка

Установить JDK 17, Node 24, pnpm 11.25.0, Android SDK Platform 36 и Build Tools 36.0.0. `ANDROID_HOME` должен указывать на SDK. Сборка не требует секретов Sites.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit --incremental false
pnpm android:web
cd android
./gradlew assembleDebug
```

Тестовый APK имеет суффикс `.debug` и отдельную debug-подпись. Для публикации использовать release. Распаковать личный комплект подписи вне репозитория и передать путь к его файлу настроек:

```sh
export PERIMETER_SIGNING_FILE=/absolute/private/path/signing.properties
./gradlew assembleRelease bundleRelease lintRelease
```

Без `PERIMETER_SIGNING_FILE` сборка release останавливается. Для разработки используйте `assembleDebug`. Выданный пользователю `perimeter-0.4.1-release.apk` собирался с приватным файлом и проверялся `apksigner`.

Для следующих обновлений увеличить versionCode и сохранить packageName/ключ подписи. Архив ключа и пароли не должны попадать в GitHub. Подготовленный workflow `.github/workflows/android-rustore.yml` запускается вручную; требует секреты PERIMETER_KEYSTORE_BASE64, PERIMETER_STORE_PASSWORD, PERIMETER_KEY_PASSWORD и PERIMETER_KEY_ALIAS. Workflow не публикует приложение в магазин автоматически.

## Поведение

- WebViewAssetLoader отдаёт только встроенные файлы по HTTPS-источнику `appassets.androidplatform.net`.
- Файловый доступ, content:// и незашифрованный трафик отключены. Произвольные удалённые ресурсы WebView блокируются; разрешён только настроенный игровой API. Внешние HTTPS-ссылки по нажатию открываются отдельно в браузере.
- AndroidX WebMessageListener принимает только сообщения главного фрейма встроенного origin. `addJavascriptInterface` не используется.
- Локальный матч сохраняется после изменений. При возврате к дуэли на одном устройстве сначала показывается экран передачи хода.
- Кнопка «Назад» закрывает верхний интерфейсный слой, затем спрашивает о выходе. Системные панели, вырезы и клавиатура учитываются нативными insets.
- Review и Update SDK подключены в `app/build.gradle`; нативная интеграция — `MainActivity.java`.

## Сетевая игра

`mobile/config.json` задаёт `onlineOrigin` (точный HTTPS origin API без пути, порт 443) и `privacyPolicyUrl` (публичная политика). До выбора адреса `onlineOrigin` оставлен пустым: такая проверочная сборка поддерживает только бота и локальную дуэль и не подходит для заявленного сетевого релиза.

При заданном адресе Java и веб-часть используют один конфиг. В APK встроены интерфейс и рисунки. Нативный allowlist пропускает только `/api/rooms` GET/POST, `/api/metrics` POST и `/api/health` GET, а также их OPTIONS. Произвольные удалённые страницы, скрипты и экспорт владельца блокируются. Fetch не отправляет cookies и не следует редиректам. Worker принимает точный origin `https://appassets.androidplatform.net`, разрешает Authorization/Content-Type; ключ места, ревизия и скрытые данные проверяются как в веб-версии.

После изменения конфига выполнить `pnpm android:web`: Gradle сверяет `perimeter-build.json` с конфигом, чтобы не упаковать старый адрес. Перед магазинной сборкой выполнить `node scripts/check-android-release.mjs`: он проверяет адрес, ссылку на политику, контакт, владельца, рейтинг и соответствие версий. Проверка также включена в ручной release-workflow. Она не заменяет тест APK на телефоне и модерацию.

Для сетевого релиза сервер должен поддерживать Android CORS. Примените серверное обновление до выпуска APK и проверьте матч Android ↔ браузер и Android ↔ Android, потерю связи, возвращение в комнату, её закрытие и метрики. [Материалы кандидата 0.5.0](../release/rustore/0.5.0/README.md).

## Проверка

Автотесты движка/комнат/сохранений: `pnpm test`. TypeScript: команда выше. Android: `lintRelease`. Стандартные lint-предупреждения о JavaScript в WebView и оформлении иконки не скрываются baseline-файлом. Реальный тест установки, обновления через RuStore и ревью по-прежнему требуется: [сценарии](../release/rustore/0.5.0/device-test.md).

Исходная веб-игра: commit `8737db6ffbe3c36c31d09ee9dc3364de22da5775`. Эта Android-версия подготовлена отдельно от опубликованного сайта. Исходники перенесены в `Moonwuk/perimetr`. Ранее указанный адрес `Moonwuk/perimeter` был ошибочным. Подписанные APK/AAB 0.4.1 находятся в [release/rustore/builds](../release/rustore/builds/README.md).
