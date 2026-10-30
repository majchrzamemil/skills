#!/usr/bin/env bash
# Link every skill in this repo into the skill directories used by agent harnesses.
# Symlinks mean `git pull` updates every harness at once.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$REPO_DIR/skills"

# Claude Code installs from the marketplace (`.claude-plugin/marketplace.json`),
# so by default this script only wires the hosts that read a plain skills dir.
# `--with-claude-links` adds the symlink route, for people who would rather not
# register a marketplace (do not use both: the skill would load twice).
TARGETS=(
  "$HOME/.config/opencode/skills"     # OpenCode native path
)

DRY_RUN=0
UNINSTALL=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)            DRY_RUN=1 ;;
    --uninstall)          UNINSTALL=1 ;;
    --with-claude-links)  TARGETS+=("$HOME/.claude/skills") ;;
    -h|--help)
      cat <<'EOF'
Usage: ./install.sh [--dry-run] [--uninstall] [--with-claude-links]

  --dry-run            print what would happen, change nothing
  --uninstall          remove the symlinks created by this script
  --with-claude-links  also symlink into ~/.claude/skills

Claude Code should install from the marketplace instead:
  claude plugin marketplace add <owner>/<repo>
  claude plugin install <skill> --marketplace <owner>/<repo>
EOF
      exit 0
      ;;
    *) echo "unknown option: $arg" >&2; exit 1 ;;
  esac
done

# Uninstall also cleans the Claude Code path, because earlier versions of this
# script created links there. Removing a link that does not exist is a no-op.
if [ "$UNINSTALL" -eq 1 ]; then
  case " ${TARGETS[*]} " in
    *" $HOME/.claude/skills "*) ;;
    *) TARGETS+=("$HOME/.claude/skills") ;;
  esac
fi

if [ ! -d "$SKILLS_DIR" ]; then
  echo "no skills/ directory in $REPO_DIR" >&2
  exit 1
fi

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  would: $*"
  else
    "$@"
  fi
}

found=0
for skill_path in "$SKILLS_DIR"/*/; do
  [ -f "${skill_path}SKILL.md" ] || continue
  found=1
  name="$(basename "$skill_path")"

  for target in "${TARGETS[@]}"; do
    link="$target/$name"
    if [ "$UNINSTALL" -eq 1 ]; then
      if [ -L "$link" ]; then
        echo "remove  $link"
        run rm "$link"
      fi
      continue
    fi

    if [ -L "$link" ]; then
      current="$(readlink "$link")"
      if [ "$current" = "${skill_path%/}" ]; then
        echo "ok      $link"
        continue
      fi
      echo "replace $link -> ${skill_path%/}"
      run rm "$link"
    elif [ -e "$link" ]; then
      echo "skip    $link (exists and is not a symlink; move it away first)" >&2
      continue
    else
      echo "link    $link -> ${skill_path%/}"
    fi

    run mkdir -p "$target"
    run ln -sfn "${skill_path%/}" "$link"
  done
done

if [ "$found" -eq 0 ]; then
  echo "no skills found under $SKILLS_DIR" >&2
  exit 1
fi

echo
echo "done. restart the harness (or start a new session) so it picks up the skill."
