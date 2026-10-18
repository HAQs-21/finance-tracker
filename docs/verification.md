# Morrow 1.0.0 verification

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
