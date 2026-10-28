# Morrow

A complete Android-first rebuild of Finance Tracker. Dark, offline-first, with savings-funded category envelopes and a shared browser app.

## Money model

Earnings enter Savings. Funding a monthly category budget reserves real Savings; expenses consume that category allocation. Spending above available funds is rejected atomically. Template revisions affect their selected future scope, never earlier months. Closing an envelope returns unused funds while preserving every expense. Refunds and corrections retain an audit trail.

## Development

Requires Node 24. Run npm ci, npm run dev. npm test runs domain and persistence tests; npm run test:e2e exercises desktop and phone browser flows. npm run lint and npm run build verify the browser app. npm run android:apk builds the signed APK using the Android SDK, Java 21, and the locally preserved signing configuration. See docs/android-delivery.md.

Release verification and device-testing boundaries are documented in [docs/verification.md](docs/verification.md).

## Bringing existing records across

Open the browser app on the existing finance-tracker origin. Morrow detects FinanceTrackerApp, snapshots its unmodified source tables, and migrates history with a reconciliation receipt in Settings. Old savings transfers are not earnings. Only unspent current budgets reserve funds at cutover. Original records and ambiguous rows remain in the complete recovery file. The old database is retained.

Export Settings → Complete JSON in the browser, then Restore JSON in the Android app. Android cannot directly read the browser database. A legacy GitHub data.json file can also be restored through the reviewed JSON restore flow.

## Storage and recovery

Browser: structured IndexedDB. Android: native SQLite with named record fields. Financial changes commit atomically. Recovery checkpoints precede replacement, reset, and import. Complete JSON includes the journal, category identities, recurring template versions, budgets, and original migration records. CSV and notes are convenience exports; Excel contains formulas and a complete journal.

GitHub backup uses a checked connection, explicit review, compare-and-swap updates, and read-back verification. A missing file never clears local records. Android tokens are encrypted with Android Keystore; browser tokens remain in memory. Tokens are excluded from ledger backups. The backup branch is optional and defaults to the repository default. Use one active editing device; transfer through verified backups.

The signing directory .android-tools/signing is deliberately ignored by Git. Preserve it privately to sign future APK updates. It must never be committed.

## Design

Morrow uses a custom folded-ribbon mark, graphite night palettes, locally bundled Manrope, compact category cards, transform-based navigation and sheets, animated amounts, and reduced-motion support. Desktop and Android share the same financial rules. Savings is opened separately, with Android device authentication when available. This view lock does not encrypt the database or exported backups.

The previous implementation is preserved in legacy/finance-tracker-source.zip and Git history.
