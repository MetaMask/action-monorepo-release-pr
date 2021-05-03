#!/usr/bin/env bash

set -x
set -e
set -u
set -o pipefail

if (! git diff --quiet )
then
  echo 'working directory dirty after "yarn build"'
  exit 1
fi
