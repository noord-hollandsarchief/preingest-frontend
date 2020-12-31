#!/usr/bin/env sh
set -eu

# As of version 1.19, the official Nginx Docker image supports templates with
# variable substitution. But that uses `envsubst`, which does not allow for
# defaults for missing variables. Here, first use the regular command shell
# to set the defaults, and then let the original entry point do its work.

export PROXY_API_DEST=${PROXY_API_DEST:-http://host.docker.internal:8000/api/}

echo "Will proxy requests for /api/* to ${PROXY_API_DEST}*"

/docker-entrypoint.sh "$@"
