#!/bin/sh
set -eu
# Run as root from the repository directory in WSL. Fresh local setup only.
if ! pg_lsclusters --no-header | awk '{print $2}' | grep -qx homeclean; then
  pg_createcluster 16 homeclean --port 55432 --start -- --encoding=UTF8 --locale=C.UTF-8
fi
pg_ctlcluster 16 homeclean status || pg_ctlcluster 16 homeclean start
if [ -f .local/bootstrap.sql ]; then
  runuser -u postgres -- psql -p 55432 -v ON_ERROR_STOP=1 -f "$PWD/.local/bootstrap.sql"
  rm -- .local/bootstrap.sql
fi
install -d -o redis -g redis /var/lib/redis-homeclean
if ! redis-cli -p 56379 ping >/dev/null 2>&1; then
  runuser -u redis -- redis-server --port 56379 --bind 127.0.0.1 --protected-mode yes --daemonize yes --appendonly yes --dir /var/lib/redis-homeclean --pidfile /var/lib/redis-homeclean/redis.pid --logfile /var/lib/redis-homeclean/redis.log
fi
pg_isready -h 127.0.0.1 -p 55432
redis-cli -p 56379 ping
exit 0
