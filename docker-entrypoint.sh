#!/bin/sh
# Priklopljen disk za plakate (Railway, Docker) je lahko v lasti root. Skripta
# teče kot root, mapo preda uporabniku node in nato aplikacijo zažene kot node,
# tako da strežnik sam nikoli ne teče s pravicami root.
set -e
mkdir -p /app/uploads/posters
chown -R node:node /app/uploads
exec su-exec node "$@"
