#!/usr/bin/env bash
# migrate-ideas.sh — One-time migration from .md files to GitHub Issues
# Requires: gh CLI authenticated with access to samgibson-bot/gold-ideas
#
# Usage:
#   ./scripts/migrate-ideas.sh          # Dry run (default)
#   ./scripts/migrate-ideas.sh --apply  # Actually create/update issues
set -euo pipefail

REPO="samgibson-bot/gold-ideas"
DRY_RUN=true

if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
  echo "=== APPLY MODE — changes will be made ==="
else
  echo "=== DRY RUN — pass --apply to make changes ==="
fi

# ---- Step 1: Create missing labels ----
# label:color pairs (bash 3.2 compatible)
LABEL_NAMES="elaborating reviewing building completed archived"
LABEL_elaborating="1d76db"
LABEL_reviewing="fbca04"
LABEL_building="7057ff"
LABEL_completed="0e8a16"
LABEL_archived="cccccc"

echo ""
echo "--- Step 1: Ensure labels exist ---"
existing_labels=$(gh label list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null || echo "")

for label in $LABEL_NAMES; do
  eval "color=\$LABEL_${label}"
  if echo "$existing_labels" | grep -qx "$label"; then
    echo "  [skip] Label '$label' already exists"
  else
    echo "  [create] Label '$label' with color #${color}"
    if [[ "$DRY_RUN" == false ]]; then
      gh label create "$label" --repo "$REPO" --color "${color}" --description "Idea status: $label"
    fi
  fi
done

# Also ensure 'idea' and 'seed' labels exist
for label in idea seed validated; do
  if echo "$existing_labels" | grep -qx "$label"; then
    echo "  [skip] Label '$label' already exists"
  else
    echo "  [create] Label '$label'"
    if [[ "$DRY_RUN" == false ]]; then
      gh label create "$label" --repo "$REPO" --color "ededed" --description "Idea label: $label"
    fi
  fi
done

# ---- Step 2: Clone repo to temp dir for file access ----
echo ""
echo "--- Step 2: Fetching idea files ---"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
gh repo clone "$REPO" "$TMPDIR/gold-ideas" -- --depth 1 --branch main 2>/dev/null

# ---- Step 3: Process each .md file ----
echo ""
echo "--- Step 3: Processing idea files ---"

process_file() {
  local filepath="$1"
  local filename
  filename=$(basename "$filepath" .md)

  # Parse frontmatter
  local title="" status="seed" created="" issue_num="" tags_raw=""
  local in_frontmatter=false
  local frontmatter_done=false
  local body_lines=""

  while IFS= read -r line; do
    if [[ "$frontmatter_done" == false ]]; then
      if [[ "$line" == "---" ]]; then
        if [[ "$in_frontmatter" == true ]]; then
          frontmatter_done=true
          continue
        else
          in_frontmatter=true
          continue
        fi
      fi
      if [[ "$in_frontmatter" == true ]]; then
        case "$line" in
          title:*) title=$(echo "${line#title:}" | sed 's/^[[:space:]]*"//;s/"[[:space:]]*$//');;
          status:*) status=$(echo "${line#status:}" | sed 's/^[[:space:]]*//');;
          created:*) created=$(echo "${line#created:}" | sed 's/^[[:space:]]*//');;
          issue:*) issue_num=$(echo "${line#issue:}" | sed 's/^[[:space:]]*//');;
          tags:*) tags_raw=$(echo "${line#tags:}" | sed 's/^[[:space:]]*\[//;s/\][[:space:]]*$//');;
        esac
      fi
    else
      body_lines+="$line"$'\n'
    fi
  done < "$filepath"

  # Use filename as title fallback
  if [[ -z "$title" ]]; then
    title="$filename"
  fi

  # Build labels array
  local labels="idea"
  if [[ -n "$status" ]]; then
    labels="$labels,$status"
  fi
  # Parse tags
  if [[ -n "$tags_raw" ]]; then
    IFS=',' read -ra tag_array <<< "$tags_raw"
    for tag in "${tag_array[@]}"; do
      tag=$(echo "$tag" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
      if [[ -n "$tag" ]]; then
        labels="$labels,$tag"
      fi
    done
  fi

  echo ""
  echo "  File: $filepath"
  echo "    Title: $title"
  echo "    Status: $status"
  echo "    Issue: ${issue_num:-none}"
  echo "    Labels: $labels"

  # Ensure all labels exist before applying
  if [[ "$DRY_RUN" == false ]]; then
    IFS=',' read -ra label_parts <<< "$labels"
    for lbl in "${label_parts[@]}"; do
      if ! echo "$existing_labels" | grep -qx "$lbl"; then
        gh label create "$lbl" --repo "$REPO" --color "c5def5" --description "" 2>/dev/null || true
        existing_labels="$existing_labels"$'\n'"$lbl"
      fi
    done
  fi

  # Check if issue exists and is valid
  if [[ -n "$issue_num" && "$issue_num" != "0" ]]; then
    local issue_state
    issue_state=$(gh issue view "$issue_num" --repo "$REPO" --json state --jq '.state' 2>/dev/null || echo "DELETED")

    if [[ "$issue_state" == "DELETED" ]]; then
      echo "    Action: Issue #$issue_num deleted/missing — will CREATE new issue"
      if [[ "$DRY_RUN" == false ]]; then
        gh issue create --repo "$REPO" \
          --title "$title" \
          --body "$body_lines" \
          --label "$labels"
      fi
    else
      echo "    Action: Issue #$issue_num exists (state: $issue_state) — will UPDATE labels"
      if [[ "$DRY_RUN" == false ]]; then
        gh issue edit "$issue_num" --repo "$REPO" \
          --add-label "$labels"
        # If completed/archived, close the issue
        if [[ "$status" == "completed" || "$status" == "archived" ]]; then
          gh issue close "$issue_num" --repo "$REPO"
        elif [[ "$issue_state" == "CLOSED" && "$status" != "completed" && "$status" != "archived" ]]; then
          gh issue reopen "$issue_num" --repo "$REPO"
        fi
      fi
    fi
  else
    echo "    Action: No issue — will CREATE new issue"
    if [[ "$DRY_RUN" == false ]]; then
      gh issue create --repo "$REPO" \
        --title "$title" \
        --body "$body_lines" \
        --label "$labels"
    fi
  fi
}

# Process active ideas
for f in "$TMPDIR/gold-ideas/ideas/"*.md; do
  [[ -f "$f" ]] || continue
  process_file "$f"
done

# Process completed ideas
if [[ -d "$TMPDIR/gold-ideas/ideas/completed" ]]; then
  for f in "$TMPDIR/gold-ideas/ideas/completed/"*.md; do
    [[ -f "$f" ]] || continue
    process_file "$f"
  done
fi

echo ""
echo "--- Done ---"
if [[ "$DRY_RUN" == true ]]; then
  echo "This was a dry run. Run with --apply to make changes."
fi
