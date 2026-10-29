#!/usr/bin/env bash
# Validate every skill against the Agent Skills rules that matter for portability.
# Bash 3.2 compatible (macOS default).
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_DIR/skills"
failures=0
checked=0

fail() { echo "  FAIL  $*"; failures=$((failures + 1)); }
warn() { echo "  warn  $*"; }
ok()   { echo "  ok    $*"; }

for skill_path in "$SKILLS_DIR"/*/; do
  [ -d "$skill_path" ] || continue
  name_dir="$(basename "$skill_path")"
  file="$skill_path/SKILL.md"

  echo "$name_dir"
  checked=$((checked + 1))

  if [ ! -f "$file" ]; then
    fail "missing SKILL.md"
    continue
  fi

  first_line="$(head -n 1 "$file")"
  if [ "$first_line" != "---" ]; then
    fail "SKILL.md must start with a '---' frontmatter block"
    continue
  fi

  # frontmatter = lines between the first and second '---'
  fm="$(awk 'NR==1{next} /^---[[:space:]]*$/{exit} {print}' "$file")"

  name="$(printf '%s\n' "$fm" | sed -n 's/^name:[[:space:]]*//p' | head -n 1 | tr -d '"'"'"'')"
  desc="$(printf '%s\n' "$fm" | sed -n 's/^description:[[:space:]]*//p' | head -n 1)"

  # --- name ---
  if [ -z "$name" ]; then
    fail "frontmatter: missing 'name'"
  elif ! printf '%s' "$name" | grep -Eq '^[a-z0-9]+(-[a-z0-9]+)*$'; then
    fail "frontmatter: 'name' must be lowercase letters, digits and single hyphens (got: $name)"
  elif [ "${#name}" -gt 64 ]; then
    fail "frontmatter: 'name' longer than 64 characters"
  elif [ "$name" != "$name_dir" ]; then
    fail "frontmatter: 'name' ($name) must match the folder name ($name_dir)"
  else
    ok "name: $name"
  fi

  # --- description ---
  if [ -z "$desc" ]; then
    fail "frontmatter: missing 'description'"
  elif [ "${#desc}" -gt 1024 ]; then
    fail "frontmatter: 'description' longer than 1024 characters (${#desc})"
  else
    ok "description: ${#desc} chars"
  fi

  # --- portability ---
  if printf '%s\n' "$fm" | grep -Eq '^allowed-tools:'; then
    warn "'allowed-tools' is Claude Code only; other harnesses ignore it"
  fi
  if printf '%s\n' "$fm" | grep -Eq '^(model|tools|permissions):'; then
    warn "harness-specific frontmatter key found"
  fi

  if grep -Eq '(/Users/|/home/[a-z]|~/|[A-Za-z]:\\)' "$file"; then
    fail "absolute path found in SKILL.md (breaks zip/clone portability)"
  else
    ok "no absolute paths"
  fi

  # --- referenced files must exist ---
  for ref in $(grep -Eo '(references|scripts)/[A-Za-z0-9_./-]+\.(md|mjs|js|sh|py)' "$file" | sort -u); do
    if [ -e "$skill_path/$ref" ]; then
      ok "ref exists: $ref"
    else
      fail "SKILL.md references a missing file: $ref"
    fi
  done

  # --- scripts must be dependency-free ---
  if [ -d "$skill_path/scripts" ]; then
    for js in "$skill_path"/scripts/*.mjs "$skill_path"/scripts/*.js; do
      [ -f "$js" ] || continue
      bad_imports="$(grep -Eo "from ['\"][^'\"]+['\"]" "$js" | grep -Ev "from ['\"](node:|\.{1,2}/)" || true)"
      if [ -n "$bad_imports" ]; then
        fail "$(basename "$js") imports a non-Node dependency: $bad_imports"
      fi
    done
    ok "scripts present"
  fi
done

echo
if [ "$checked" -eq 0 ]; then
  echo "no skills found in $SKILLS_DIR"
  exit 1
fi
if [ "$failures" -gt 0 ]; then
  echo "$failures problem(s) found"
  exit 1
fi
echo "all $checked skill(s) valid"
