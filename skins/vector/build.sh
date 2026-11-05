#!/usr/bin/env bash
# Builds every <name>.src.svg under this folder into <name>.svg with all text
# converted to paths, so the result renders the same without the fonts.
# (SVGs used as images or masks can't load web fonts.)
#
# Usage: ./build.sh [-f]   -f rebuilds everything, not just stale outputs.
#
# The fonts must be installed locally: Inkscape falls back to another font
# silently, so the script checks each font-family against fontconfig first.
set -euo pipefail

cd "$(dirname "$0")"

force=0
[[ "${1:-}" == "-f" ]] && force=1

command -v inkscape >/dev/null || { echo "inkscape not found on PATH" >&2; exit 1; }

installed_fonts=$(fc-list : family 2>/dev/null | tr ',' '\n' || true)

missing_font() {
  local fam
  while read -r fam; do
    [[ -z "$fam" ]] && continue
    if ! grep -qixF -- "$fam" <<<"$installed_fonts"; then
      echo "$fam"
    fi
  done < <(grep -oE "font-family:[^;\"]*" "$1" | sed -E "s/font-family:\s*//; s/['\"]//g" | tr ',' '\n' | sed -E 's/^\s+|\s+$//g' | grep -viE '^(serif|sans-serif|monospace)$' | sort -u)
}

built=0 skipped=0 failed=0
while IFS= read -r -d '' src; do
  out="${src%.src.svg}.svg"
  if (( ! force )) && [[ "$out" -nt "$src" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  if command -v fc-list >/dev/null; then
    fonts=$(missing_font "$src")
    if [[ -n "$fonts" ]]; then
      echo "FAIL $src: font(s) not installed: $(echo "$fonts" | paste -sd, -)" >&2
      failed=$((failed + 1))
      continue
    fi
  fi

  echo "build $src -> $out"
  inkscape "$src" \
    --export-text-to-path \
    --export-plain-svg \
    --vacuum-defs \
    --export-filename="$out" 2> >(grep -v -e '^$' -e 'Gtk-WARNING' >&2 || true)

  if grep -q '<text' "$out"; then
    echo "WARN $out still contains <text> elements" >&2
  fi
  built=$((built + 1))
done < <(find . -name '*.src.svg' -print0 | sort -z)

echo "built $built, up to date $skipped, failed $failed"
(( failed == 0 ))
