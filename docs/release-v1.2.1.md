# Morrow 1.2.1

- Fixed Android keyboard input capture bypassing normal WebView input events, which could leave a visibly entered token undetected.
- Save connection reads the actual displayed field values, including autofill or paste without input/change events. Saved-token loading does not replace a token already entered by the user.
- Save connection stays clickable when idle. Missing repository/token values show a specific validation message instead of silently disabling the action.
- Token encryption, checked connections, revision protection, and ledger data are unchanged. Install over the existing app.
