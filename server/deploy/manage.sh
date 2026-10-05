#!/bin/sh
set -eu
umask 077
deploy_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
local_mode=0
if [ "${1:-}" = "--local" ]; then local_mode=1; shift; fi
compose() {
  if [ "$local_mode" -eq 1 ]; then
    docker compose --env-file "$deploy_dir/.env" -f "$deploy_dir/compose.yml" -f "$deploy_dir/compose.local.yml" "$@"
  else
    docker compose --env-file "$deploy_dir/.env" -f "$deploy_dir/compose.yml" "$@"
  fi
}
start() {
  if [ "$local_mode" -eq 1 ]; then compose up -d --build --remove-orphans app backups;
  else compose up -d --build --remove-orphans; fi
}
[ -f "$deploy_dir/.env" ] || { echo "Сначала выполните sh deploy/setup.sh (см. README.md)." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Сначала установите Docker Engine и Compose plugin (см. README.md)." >&2; exit 1; }
case "${1:-}" in
  start) start ;;
  stop) compose stop ;;
  status) compose ps ;;
  logs) compose logs --tail 100 app caddy backups ;;
  health) compose exec -T app node -e "fetch('http://127.0.0.1:8080/api/health').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)}).catch(()=>process.exit(1))" ;;
  backup) compose exec -T backups node /app/deploy/backup.mjs once ;;
  snapshots) compose exec -T backups node -e "require('node:fs').readdirSync('/backups').filter(n=>n.endsWith('.sqlite')).sort().forEach(n=>console.log(n))" ;;
  metrics)
    output=${2:-metrics-$(date -u +%Y%m%dT%H%M%SZ).json}
    temporary=$(mktemp -- "${output}.XXXXXX")
    trap 'rm -f -- "$temporary"' EXIT HUP INT TERM
    compose exec -T app node /app/deploy/export-metrics.mjs > "$temporary"
    mv -- "$temporary" "$output"
    trap - EXIT HUP INT TERM
    printf 'Метрики сохранены: %s\n' "$output"
    ;;
  restore)
    snapshot=${2:-}
    case "$snapshot" in */*) echo "Укажите только имя файла, без пути." >&2; exit 1;; perimeter-*.sqlite|before-restore-*.sqlite) ;; *) echo "Укажите имя из команды snapshots." >&2; exit 1;; esac
    compose exec -T backups node -e "const n=process.argv[1]; if (!/^(?:perimeter|before-restore)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/.test(n)||!require('node:fs').existsSync('/backups/'+n)) process.exit(1)" "$snapshot"
    echo "Останавливаю игру; восстанавливаю выбранную копию. Текущее состояние сохраняется отдельно."
    compose stop app backups
    compose run --rm --no-deps -e CONFIRM_RESTORE=1 app node /app/deploy/restore.mjs "$snapshot"
    start
    ;;
  *) echo "Команды: [--local] start | stop | status | health | logs | backup | snapshots | metrics [file.json] | restore [snapshot.sqlite]" >&2; exit 1 ;;
esac
