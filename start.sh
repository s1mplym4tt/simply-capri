#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
exec ./node_modules/.bin/electron . --ozone-platform=x11 "$@"
