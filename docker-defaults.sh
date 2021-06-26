#!/usr/bin/env sh
set -eu

# As of version 1.19, the official Nginx Docker image supports templates with
# variable substitution. But that uses `envsubst`, which does not allow for
# defaults for missing variables. Here, first use the regular command shell
# to set the defaults:
export PROXY_API_DEST=${PROXY_API_DEST:-http://host.docker.internal:8000/api/}

export PROXY_EVENTHUB_DEST=${PROXY_EVENTHUB_DEST:-http://host.docker.internal:8000/preingestEventHub/}

# Due to `set -u` this would fail if not defined and no default was set above
echo "Will proxy requests for /api/* to ${PROXY_API_DEST}*"
echo "Will proxy requests for /preingestEventHub/* to ${PROXY_EVENTHUB_DEST}*"

# Next, let the original Nginx entry point do its work, with whatever is set
# for CMD; use `exec` to ensure this replaces the current process, so traps any
# signals Docker may send it (like Ctrl+C)
exec /docker-entrypoint.sh "$@"
