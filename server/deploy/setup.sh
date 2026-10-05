#!/bin/sh
set -eu
umask 077
deploy_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
config_file="$deploy_dir/.env"
if [ -e "$config_file" ]; then
  echo "Настройки уже существуют: deploy/.env. Файл не изменён." >&2
  exit 1
fi
if [ "${1:-}" = "--local" ] && [ "$#" -eq 1 ]; then
  domain=localhost
  email=local@example.invalid
elif [ "$#" -eq 2 ]; then
  domain=$1
  email=$2
  if ! printf '%s\n' "$domain" | LC_ALL=C awk 'length($0)<=253 && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/ {ok=1} END {exit !(NR==1 && ok)}'; then
    echo "Первый аргумент — домен без https://, пути и порта." >&2
    exit 1
  fi
  if ! printf '%s\n' "$email" | LC_ALL=C awk '/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]+$/ {ok=1} END {exit !(NR==1 && ok)}'; then
    echo "Второй аргумент — email для уведомлений о сертификате." >&2
    exit 1
  fi
else
  echo "Использование: sh deploy/setup.sh game.example.com admin@example.com" >&2
  echo "Без домена, только SSH-туннель: sh deploy/setup.sh --local" >&2
  exit 1
fi
token=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
[ "${#token}" -eq 64 ] || { echo "Не удалось создать ключ." >&2; exit 1; }
# Noclobber also protects against a simultaneous setup invocation.
(set -C; cat > "$config_file" <<EOF
DOMAIN=$domain
ACME_EMAIL=$email
METRICS_EXPORT_TOKEN=$token
BACKUP_INTERVAL_HOURS=6
BACKUP_KEEP=28
API_REQUESTS_PER_MINUTE=600
ROOM_ADMISSIONS_PER_MINUTE=12
EOF
)
echo "Создан deploy/.env с отдельным ключом владельца (права 600)."
echo "Ключ не выводится и не нужен игрокам."
