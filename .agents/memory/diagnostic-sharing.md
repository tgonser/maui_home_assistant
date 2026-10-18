---
name: Diagnostic sharing scope
description: Why diagnostic sharing uses explicit, user-reviewed snapshots rather than live remote access.
---

Keep troubleshooting exports read-only and user-controlled; do not expand them into persistent agent access without explicit approval.

**Why:** The user approved the basic downloadable snapshot approach to minimize manual setup, avoid new credentials and avoid another Home Assistant package installation.

**How to apply:** Offer review before download and make sharing a separate user action. Expanding into logs, YAML, execution traces or remote connections needs a separate scope decision.
