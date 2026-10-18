# Morrow 1.0.0 verification

## 1.1.0 interface and performance verification

45 finance/data tests and the 14 existing desktop/phone browser flows pass. The native release APK passes startup, earnings, budgets, expenses, JSON export/restore, legacy restore, and damaged-metadata recovery. A separate Android 15 emulator test sets a disposable PIN, verifies Savings stays hidden before OS authentication, unlocks it with that credential, checks FLAG_SECURE, and confirms backgrounding closes the view. The test removes its synthetic PIN afterward and refuses physical hardware.

`scripts/profile-ui.mjs` profiles an isolated 390 × 844 browser with 5,000 expenses and 6× CPU throttling. The same scripted navigation, repeated category openings, and scrolling measured: long-task total 89,439 → 1,494 ms; longest task 13,653 → 166 ms; median navigation 518 → 200 ms; p95 RAF gap 600 → 33 ms; dashboard words 225 → 105; DOM elements 709 → 412. Animations remain enabled. RAF gaps include cold loading and interaction work; they are not a measured physical-phone FPS guarantee.

## 1.0.1 Android regression verification

The 1.0.0 Android startup failure was reproduced on an Android 15 x86_64 emulator. The journal-mode PRAGMA returns a row and must use Capacitor SQLite's query method instead of its execSQL-backed execute method. The corrected app passes `NativeLedgerTest` through the real WebView and native SQLite bridge: startup, earnings, funded budgets, expenses, recreation persistence, native JSON export, complete recovery restore, legacy Finance Tracker restore, damaged-metadata recovery, and preservation of pre-restore snapshots. Synthetic data is used throughout. The test does not open a competing platform SQLite connection against SQLCipher's live database.

The browser gesture test waits for the animated handle to settle and sends an actual touch swipe. This removes the race caused by sampling a moving handle and simulating a mouse drag in phone mode. Developer file watching excludes emulator files and Android build outputs.

Physical phone validation is still separate from emulator verification.

## Original 1.0.0 checks

Verified on October 18, 2026.

- **45 financial and persistence tests pass.** Coverage includes exact paisa arithmetic, immutable commands, strict category caps, allocation changes, recurring template versions, rollover shortages, corrections, refunds, archival, complete backup validation, legacy reconciliation, concurrent browser writes, imports, Excel formulas, and GitHub backup conflicts.
- **14 browser flows pass** across desktop (1440 × 1000) and phone (390 × 844) layouts. These exercise funding and spending, legacy IndexedDB migration, JSON download and reviewed restore, recovery snapshots, envelope closure and reopening, expense corrections, preferences, keyboard dismissal, retained Activity filters, and motion-enabled sheets.
- TypeScript production compilation and ESLint pass. Production dependency audit reports no known vulnerabilities.
- Android release assembly and Android lint pass with Java 21 and Android API 36. The APK signature verifies, uses the dedicated Morrow release key, supports Android 7.0 and later, and includes ARM and x86 native libraries.
- No physical Android device or configured emulator was available. Native installation, SQLite integration on a device, haptics, and Android sharing therefore still require device testing. Phone-layout browser tests do not establish native runtime behavior.

The 50,000-entry domain test completes its atomic batch in about half a second on the development machine. This is a local benchmark, not a device performance guarantee. Activity renders a virtualized list, spreadsheet code loads on demand, and repeated financial selectors reuse an immutable cached projection.

## Migration boundaries

Automatic migration reads the existing browser database at the same origin, preserves its original arrays, and creates a reconciliation receipt. It is tested with legacy fixtures; it does not imply that a user's personal browser data has been accessed during development. Ambiguous records remain in the complete recovery archive instead of being discarded or guessed.

Android has a separate application sandbox. To transfer existing browser records, export **My space → Complete JSON** from the original browser address and use **Restore JSON** in Android. Keep the original file until the restored totals and migration receipt have been reviewed. CSV and text exports are convenience formats, not complete recovery archives.
