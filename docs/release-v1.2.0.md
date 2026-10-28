# Morrow 1.2.0

- Savings now shows **Balance** (all remaining money, including unspent envelopes) and **Savings** (unallocated money). For Rs40,000 earned, Rs8,000 reserved and Rs1,200 spent, these are Rs38,800 and Rs32,000. Both stay in the private Savings view.
- Savings history excludes historical imported expenses and their reversals. It shows earnings, withdrawals to budgets, returned funds and other actual Savings movements.
- Rebuilt data tools into Backup, Export, Import and GitHub tabs. Complete JSON, CSV, Excel/formulas, text, clipboard, reviewed restore, legacy migration, recovery checkpoints and GitHub operations remain available.
- Editable import cards replace the phone-unfriendly table. File sources are not rendered in a giant textarea; original source download, inferred-date notices, unmatched-line review and pagination remain available.
- GitHub setup accepts repository URLs, saves/checks the connection, distinguishes a missing backup from an invalid token, reports permission errors and limits network waits. Native networking avoids WebView CORS problems.
- Android stores the GitHub token encrypted using a key held by Android Keystore; it survives restart and is removed by Disconnect. Browser tokens stay in session memory. Tokens are never included in ledger backups.
- Cloud writes retain revision checks and read-back verification. Restore keeps a recovery copy before replacement.
- Optional backup branch selection supports repositories whose default branch differs from the app source branch. Copy notes uses the Android clipboard directly on phones.

Install over the existing app. The database format and release signing key are unchanged.
