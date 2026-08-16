#!/usr/bin/env bash
set -euo pipefail

shared_dir="${1:-../scholar-shared}"

for generated_file in contracts.d.ts core-api.d.ts; do
  shared_file="${shared_dir}/gen/ts/${generated_file}"
  client_file="gen/${generated_file}"

  if [[ ! -f "${shared_file}" ]]; then
    echo "missing shared contract: ${shared_file}" >&2
    exit 1
  fi

  if ! cmp -s "${shared_file}" "${client_file}"; then
    echo "generated contract drift: ${client_file}" >&2
    echo "sync it from ${shared_file} and commit the result" >&2
    exit 1
  fi
done

echo "scholar-client contracts match scholar-shared"
