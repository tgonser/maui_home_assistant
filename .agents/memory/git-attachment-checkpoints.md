---
name: Git attachment checkpoints
description: Prevent user-uploaded screenshots from being unintentionally published with source releases.
---

Replit may create local commits for images uploaded during troubleshooting, placing them between the GitHub base and a later source-code commit. Before pushing a release, inspect every outgoing commit and rebuild the release commit directly on the current remote base when attachment-only commits are present.

**Why:** A normal push can otherwise publish unrelated home screenshots along with the requested source fix, and the Git pane's outgoing count can make those commits look like part of the release.

**How to apply:** Compare `origin/main..main` before every release push. Preserve attachment history on a local backup branch if needed, then cherry-pick only the source fix onto a clean branch tracking `origin/main`.