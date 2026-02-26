#!/bin/bash
# night_loop.sh — Ночной цикл поиска лидов
# Запускается один раз, работает всю ночь

TGCLI_DIR="/Users/administrator/Desktop/retree/smbos/tools/tgcli"
BOT_TOKEN="8525580677:AAFxYCIP9Fi8Rlp_iy8ByeL_wYhyOSF766c"
DAVID_CHAT_ID="7981171680"
LOG_FILE="/tmp/night_loop.log"
STATE_FILE="/tmp/night_agent_state.json"

export TELEGRAM_API_ID=33887530
export TELEGRAM_API_HASH=fc51f19b4b6ff9f0b8cbd5c4005e9ee4

# Количество циклов (1 цикл = 1 час)
TOTAL_CYCLES=8

send_bot() {
  curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"${DAVID_CHAT_ID}\", \"text\": \"$1\", \"parse_mode\": \"HTML\"}" > /dev/null
}

echo "$(date): Ночной агент запущен. Циклов: $TOTAL_CYCLES" >> "$LOG_FILE"

# Инициализация состояния
echo "{\"cycle\": 0, \"searched\": [], \"sent\": [], \"found_total\": 0, \"sent_total\": 0, \"start_time\": $(date +%s)000}" > "$STATE_FILE"

# Стартовое сообщение
send_bot "🌙 <b>Ночной агент запущен!</b>

Буду искать лидов всю ночь.
Каждый час — отчёт.
10/10 лид — пишу сразу без тебя.

Планирую ${TOTAL_CYCLES} циклов (~${TOTAL_CYCLES} часов)
Спокойной ночи! 😴"

sleep 5

for CYCLE in $(seq 1 $TOTAL_CYCLES); do
  echo "$(date): === Цикл $CYCLE / $TOTAL_CYCLES ===" >> "$LOG_FILE"

  # Запускаем поиск
  cd "$TGCLI_DIR"
  node night_search.mjs "$CYCLE" >> "$LOG_FILE" 2>> "$LOG_FILE"
  EXIT_CODE=$?

  if [ $EXIT_CODE -ne 0 ]; then
    echo "$(date): Цикл $CYCLE завершился с ошибкой (exit $EXIT_CODE)" >> "$LOG_FILE"
    send_bot "⚠️ Цикл $CYCLE завершился с ошибкой. Продолжаю..."
  fi

  echo "$(date): Цикл $CYCLE завершён" >> "$LOG_FILE"

  # Ждём час перед следующим циклом (кроме последнего)
  if [ $CYCLE -lt $TOTAL_CYCLES ]; then
    echo "$(date): Жду 1 час до цикла $((CYCLE + 1))..." >> "$LOG_FILE"
    sleep 3600
  fi
done

# Финальный отчёт
FINAL_STATE=$(cat "$STATE_FILE" 2>/dev/null || echo "{}")
FOUND=$(echo "$FINAL_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('found_total',0))" 2>/dev/null || echo "?")
SENT=$(echo "$FINAL_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sent_total',0))" 2>/dev/null || echo "?")

send_bot "✅ <b>Ночная сессия завершена!</b>

Всего циклов: $TOTAL_CYCLES
Найдено лидов: $FOUND
Написано: $SENT

Полный лог: /tmp/night_loop.log
Состояние: /tmp/night_agent_state.json

Доброе утро! ☀️"

echo "$(date): Ночной агент завершил работу. Найдено: $FOUND, Написано: $SENT" >> "$LOG_FILE"
