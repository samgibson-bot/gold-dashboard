# Ideas System Simplification

**Date:** 2026-02-26
**Status:** Approved

## Problem

The ideas system accumulated complexity that wasn't being used:
- 7-stage status pipeline nobody was tracking
- Two kanbans (dashboard + GitHub) for the same data
- `idea-lifecycle` cron posting AI comments nobody was reading
- `weekly-synergy-audit` creating a new issue every week (issue sprawl)
- Free-form tags with no enforced taxonomy, no functional role in automation

The actual workflow: Nathen submits ideas, looks at the GitHub issues list. That's it.

## Design

### Tags — Fixed Two-Tier Taxonomy

Replace free-form tag input with two enforced button groups:

**Type** (required, pick one):
- `product` — user-facing features
- `infrastructure` — platform / tooling / backend
- `research` — investigations / explorations
- `automation` — cron / agent / workflow ideas

**Domain** (optional, pick any):
- `personal` `finance` `health` `social` `business`

9 tags total. Dashboard tag picker becomes two button groups, no text input.
The synergy audit uses these tags to group its analysis.

### Status — Open/Closed Only

Drop all 7 status labels (`seed`, `elaborating`, `reviewing`, `validated`, `building`, `completed`, `archived`).

- Open issue = active idea
- Closed issue = done or archived (GitHub `reason` field: completed vs. not-planned)

No status to manage. No kanban moves.

### Dashboard Ideas Screen

Replace the 7-column kanban with a simple list view:
- Grouped by type tag, then domain tag
- Shows title, issue number, domain tags, date
- Click to open detail modal (unchanged except status selector removed)
- New idea dialog: tag picker becomes two button groups

### idea-lifecycle Cron — Remove

Delete:
- Cron job via dashboard
- `~/.openclaw/workspace/scripts/idea-lifecycle.sh` from VPS
- All references in OpenClaw workspace knowledge files

Stale-idea detection absorbed by the synergy audit's weekly stale flags section.

### Weekly Synergy Audit — Rolling Issue + Targeted Comments

**Change from:** Creates a new GitHub issue every week.

**Change to:**

1. **Rolling pinned issue** — first run creates one issue titled `Weekly Synergy Audit` with label `audit` in `gold-ideas`, pins it. Every subsequent run posts a new comment (date as header). No new issues ever created.

2. **Comment structure** (each week):
   - **Synergies** — ideas that combine to unlock something bigger (grouped by type + domain tags)
   - **Overlaps** — near-duplicates worth merging
   - **Unblocked** — ideas now actionable due to recent completions
   - **Stale flags** — open ideas with no activity >14 days
   - **Bold call** — one specific recommendation (archive X, fast-track Y, merge A+B)

3. **Targeted comments (guardrails)**:
   - Max 2 per run
   - Only when the insight adds something not already in the issue body
   - Sentinel `<!-- synergy-YYYY-WW -->` prevents duplicates
   - Comment links back: `Full context: #[audit-issue]`

### GitHub Kanban — Delete

Delete the GitHub Project board on `samgibson-bot/gold-ideas`. The issues list is the source of truth.

## What Gets Removed

| Item | Action |
|------|--------|
| 7 status labels | Remove from all open issues |
| Dashboard kanban view | Replace with list view |
| GitHub kanban | Delete |
| `idea-lifecycle` cron | Delete |
| `idea-lifecycle.sh` | Delete from VPS |
| Status selector in detail modal | Remove |
| Free-form tag input | Replace with button groups |

## What Gets Added / Changed

| Item | Action |
|------|--------|
| Fixed tag taxonomy (9 tags) | Enforce via button groups in dashboard |
| Dashboard ideas list view | Replace kanban columns |
| Synergy audit rolling issue | One-time create, comment weekly |
| Synergy audit targeted comments | Max 2/run with sentinel guard |
| OpenClaw knowledge files | Update to remove idea-lifecycle references |
