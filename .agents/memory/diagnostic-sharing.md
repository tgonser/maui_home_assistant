---
name: Diagnostic sharing scope
description: Why diagnostic sharing uses explicit, user-reviewed snapshots rather than live remote access.
---

Keep troubleshooting exports read-only and user-controlled; do not expand them into persistent agent access without explicit approval. The user subsequently approved extending HA Survey to share reviewed snapshots directly with this development project, avoiding repeated manual file uploads.

**Why:** The user approved the basic downloadable snapshot approach to minimize manual setup, avoid new credentials and avoid another Home Assistant package installation.

**How to apply:** Offer review before sharing and keep sharing separate from HA installation or activation. Never treat failed configuration reads as proof that automations or scripts do not exist. Project YAML is not proof of installed HA configuration.
