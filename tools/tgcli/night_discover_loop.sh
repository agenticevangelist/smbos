#!/bin/bash
# night_discover_loop.sh — Параллельный разведчик новых групп

TGCLI_DIR="/Users/administrator/Desktop/retree/smbos/tools/tgcli"
export TELEGRAM_API_ID=33887530
export TELEGRAM_API_HASH=fc51f19b4b6ff9f0b8cbd5c4005e9ee4

TOTAL_CYCLES=8

cd "$TGCLI_DIR"

# Смещение 30 минут от основного агента — чтобы не конфликтовали соединения
sleep 1800  # 30 минут

for CYCLE in $(seq 1 $TOTAL_CYCLES); do
  echo "$(date): Discover cycle $CYCLE" >> /tmp/night_discover.log
  node night_discover.mjs "$CYCLE" >> /tmp/night_discover.log 2>&1 || true

  if [ $CYCLE -lt $TOTAL_CYCLES ]; then
    sleep 3600
  fi
done

echo "$(date): Discover agent завершён" >> /tmp/night_discover.log
