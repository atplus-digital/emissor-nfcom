#!/usr/bin/env sh
set -eu

PACKAGE_MANAGER="bun"

repo_root() {
  git rev-parse --show-toplevel
}

run_pm() {
  "$PACKAGE_MANAGER" "$@"
}

# Cores ANSI — desligadas sem TTY ou com NO_COLOR definido.
# $1 = fd (1 stdout | 2 stderr), $2 = código SGR.
color() {
  [ -t "$1" ] && [ -z "${NO_COLOR:-}" ] && printf '\033[%sm' "$2"
}
