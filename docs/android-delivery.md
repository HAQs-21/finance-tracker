# Morrow for Android

The Android application bundles the same Morrow interface and financial engine as the browser version. Financial records use the native SQLite adapter. A browser installation cannot expose its IndexedDB to a different Android application: export a complete recovery archive from the browser and restore it in Android to transfer existing records.

## Build

Requirements: Node.js 24, Java 21, an Android SDK with API 36/build-tools 35.0.0, and accepted Android SDK licenses.

```powershell
npm ci
npm run android:apk
```

The script builds relative-path web assets, syncs Capacitor, compiles the Android application, runs Android lint, and writes `dist-apk/Morrow-1.0.0.apk` with a SHA-256 checksum. Set `JAVA_HOME` and `ANDROID_HOME` when installed in nonstandard locations. Open `android/` in Android Studio for device profiling and native development.

## Install and updates

Transfer the APK to your phone and open it. Android may ask you to allow installation from the file browser used to open it. No account or application server is required for local bookkeeping.

The installed delivery is a **release APK signed with Morrow's dedicated persistent key**. Keep the complete local `.android-tools/signing/` directory in a secure offline backup. Both `morrow-release.jks` and `morrow-signing.json` are required for compatible future updates. They are deliberately ignored by Git. Never upload this directory, its passwords, or the private key to a release or source repository.

The local build script reads that ignored signing configuration without printing its secrets. It can instead use environment variables `MORROW_KEYSTORE_FILE`, `MORROW_STORE_PASSWORD`, `MORROW_KEY_ALIAS`, and `MORROW_KEY_PASSWORD`.

For compatible release builds in GitHub Actions, configure repository secrets `MORROW_KEYSTORE_BASE64` (the base64-encoded keystore file), `MORROW_STORE_PASSWORD`, `MORROW_KEY_ALIAS`, and `MORROW_KEY_PASSWORD`. Without those secrets, CI produces a **development-signed** evaluation artifact. Its temporary key differs from the installed release key, so it cannot update the release installation. `-DebugBuild` on the local PowerShell script is also only for development.

An APK update does not copy or synchronize records from another installation. Export and verify a recovery archive before switching devices.

## Continuous delivery

Every push to `master` verifies the financial tests, desktop and phone browser flows, lint, and browser production build. The Android workflow builds an installable APK artifact after verification. The Pages workflow publishes the browser version at the repository's GitHub Pages address when Pages is configured to use GitHub Actions.

APK artifacts are downloadable from the successful GitHub Actions run under **Morrow-Android-Release-APK** or **Morrow-Android-Debug-APK**. Development files have a `-development.apk` suffix. These workflows do not contain credentials or automatically overwrite personal finance backups.

The release helper `node scripts/release-github.mjs --check` verifies repository access and reports existing Pages settings without changing GitHub. After the tested commit is pushed, `node scripts/release-github.mjs --enable-pages` selects GitHub Actions as the Pages build source while preserving its domain and HTTPS settings. When the Pages environment has a custom branch allowlist, it adds `master` alongside the existing allowed branches so the workflow can deploy. `node scripts/release-github.mjs --publish --tag v1.0.0 --notes-file path-to-release-notes.md` uploads the signed APK and checksum to a draft release, then publishes it only once both uploads succeed. It uses an existing environment token or Git Credential Manager in memory and never prints credentials.
