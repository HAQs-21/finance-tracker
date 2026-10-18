# Morrow 1.1.0

- Compact dark interface with short headings, smaller category cards, and direct expense entry.
- Savings stays off the dashboard. Tap Savings to open it; Android uses fingerprint or device credentials when enrolled. It closes on backgrounding and blocks screenshots while open. This protects the view; it does not encrypt exported backups.
- Shared month navigation in Budgets, Expenses, and Reports; all-time and custom date filters remain available.
- Virtualized category and Savings histories preserve access to every record without rendering the entire journal.
- Transform/opacity sheet, navigation, card, chart, button, and amount animations replace full-screen blur and shared-layout tracking. Reduced-motion support remains available.
- Cached date formatting and immutable selectors; one-pass report aggregation. Large backup files show their review summary instead of putting the full JSON into a textarea.
- Existing funded-budget rules, legacy migration, complete JSON restore, audit history, exports, and GitHub backups remain supported. No database schema change.

The 5,000-expense browser stress test at 6× CPU throttling reduced measured long-task time from 89,439 ms to 1,494 ms (98.3%) and median navigation time from 518 ms to 200 ms. These are development-machine comparisons, not a physical itel S25 frame-rate guarantee.

Install over your existing Morrow app to retain its data. The APK uses the same release signing key.
