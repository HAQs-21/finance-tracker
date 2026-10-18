Morrow 1.0.1 fixes Android startup and backup restore.

- Use the SQLite query bridge for the journal-mode PRAGMA. Android rejects this row-returning statement through execSQL, which prevented the 1.0.0 database from opening and consequently blocked restore.
- Keep the same application ID and release signing key, and increase Android's version code so this APK installs as an update over 1.0.0.
- Add a native Android regression test covering startup, saving and reopening transactions, native JSON export, complete and legacy backup restore, and recovery after damaged metadata. CI now runs this test on an Android emulator.
- Retain the corrected Android SDK setup without Google's removed `tools` package. Version APK filenames from package.json to keep future release downloads consistent.

Install Morrow-1.0.1.apk over the existing app. Do not uninstall or clear app storage. Then retry restoring your original backup from My space → Restore JSON.
