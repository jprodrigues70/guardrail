# Privacy Policy - GuardRail

Last updated: 2026-04-02

This Privacy Policy explains how the GuardRail browser extension handles user data.

## 1. Summary

- GuardRail does not collect personal data to external servers.
- GuardRail does not sell, share, or transfer data to third parties.
- Settings are stored in the browser storage (`chrome.storage.sync`), associated with the user's browser account when applicable.

## 2. Data processed

The extension may store only user-defined configuration data, such as:

- URL rules created by the user
- Environment profiles (names, enabled/disabled state)
- Visual preferences (border color, width, style)
- Per-environment banner text
- UI preferences (for example, delete confirmation)

These values are provided directly by the user in the extension interface.

## 3. Data we do NOT collect

GuardRail does not collect:

- Name, email, phone, or government IDs
- Form input content typed into websites
- Browsing history for analytics
- Tracking cookies
- Geolocation
- Biometric data

## 4. Permissions used

The extension uses:

- `storage`: to save and read extension settings.
- `tabs`: to read the active tab URL only when the user clicks "Use current URL".

The `tabs` permission is used locally and data is not sent to external servers.

## 5. Data storage location

Data is stored in `chrome.storage.sync`.

- In supported browsers, settings may sync across devices under the same account.
- Sync is managed by the browser provider (Chrome/Edge), not by GuardRail servers.

## 6. Data sharing

GuardRail does not share user data with third parties.

## 7. Security

The extension is designed to run locally. However, no software can guarantee zero risk. Keep your browser and extensions updated.

## 8. Retention and deletion

Data remains stored until:

- the user changes/removes it in the extension popup,
- browser data is cleared,
- or the extension is uninstalled.

## 9. Intended audience

GuardRail is not specifically targeted at children.

## 10. Policy updates

This policy may be updated to reflect product changes or legal requirements. The "Last updated" date will be revised accordingly.

## 11. Contact

Maintainer: JP Rodrigues
Project: GuardRail
License: MIT

For privacy questions, open an issue in the project repository or contact the maintainer through the repository's official channels.
