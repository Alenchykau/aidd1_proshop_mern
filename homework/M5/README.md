# M5 Homework — n8n Agentic Workflows

## Архитектура

Два n8n-workflow поверх связки M3 (MCP feature-flags) + M4 (Feature Dashboard):
**WF1** — Сделан вручную по спеке. Синхронный manual trigger: кнопки в Dashboard шлют POST на n8n webhook, AI Agent через MCP крутит ручки фичи, UI отображает результат и сообщение от агента.
**WF2** — Сгенерирован с помощью агентов n8n-requirements-orchestrator.md и n8n-workflow-builder.md. Асинхронный scheduled monitor: cron каждую минуту читает `logs.json` (его пишет `simulate_wf2.py` с синусоидальным error rate), Switch принимает решение алгоритмически, AI Agent выполняет MCP-write и шлёт Telegram-алерт. Полный цикл deactivate → re-enable виден за один прогон симулятора.

## Стек

- **n8n:** self-hosted локально (`npm install -g n8n@2.21.7`), данные привязаны к проекту через `N8N_USER_FOLDER=$PWD\n8n-data`.
- **Chat Model:** Google Gemini 2.5 Flash — быстрый и бесплатный free tier, достаточно качества для tool calling в этих задачах.
- **Storage логов:** JSON-файл `homework/M5/logs.json`. Postgres / Redis Stream избыточны для домашки; файла достаточно чтобы видеть toggle-цикл и подавать в Code Node.
- **Telegram bot:** создан через @BotFather, токен в n8n credentials. Chat ID не публикую — пришлю отдельно при запросе.
- **MCP-сервер M3:** работает в двух режимах одновременно — stdio для Claude Code и Streamable HTTP + legacy SSE на `http://localhost:5680/mcp` для n8n. См. `mcp-feature-flags/server.ts`.

## WF1 — Manual trigger

- **Webhook URL:** `http://localhost:5678/webhook/feature-control`
- **Auth:** Header Auth `X-API-Key` (credential `n8n-feature-control-api-key` в n8n; ключ зеркально лежит в `frontend/.env` как `REACT_APP_N8N_API_KEY`). Ключ не публикую — пришлю отдельно.
- **Что нового в Dashboard:** новая колонка «Auto-Pilot» в `FeatureListScreen.js`; клик по строке разворачивает accordion-блок с тремя кнопками (`Запустить проверку` / `Тестовый режим` / `Откатить фичу`). Сам компонент — `frontend/src/components/AutoPilotControls.js`. Стилизация через CSS-токены из `DESIGN.md` (`var(--primary)`, `var(--space-md)`), никаких хардкодных хексов.

## WF2 — Scheduled monitor

- **Threshold deactivate:** 5%, **threshold re-enable:** 1% — гистерезис в 4 п.п. чтобы фича не дёргалась туда-сюда на шуме около границы.
- **Logs storage:** `homework/M5/logs.json`, JSON-массив. Чтение через ноду **Read/Write Files from Disk** (не `require('fs')` — sandbox Code Node при этом остаётся в дефолтной строгой конфигурации).
- **Sine period симулятора:** 300с (5 минут) по умолчанию = пол-цикла 150с — за полчаса вижу 6 toggle. Для быстрой отладки гоняю с `--period 120 --duration 600` (15 минут, ~5 циклов).
- **Telegram chat:** мой личный; ID не публикую.

## Тест на галлюцинации (Algorithm-before-AI)

Защита от `traffic_percentage: -50` стоит **тремя слоями**, ровно так как требует спека:

1. **Switch-нода в WF1** (`rules` mode) — правило `invalid_traffic`: `traffic_percentage !== undefined && (< 0 || > 100)` → output 3 → Respond to Webhook 400. Падение до AI Agent.
2. **JSON Schema MCP-сервера** — `adjust_traffic_rollout.percentage: z.number().int().min(0).max(100)` в `mcp-feature-flags/server.ts:46`. Даже если кто-то обойдёт Switch, сервер откажет с zod-валидацией.
3. **GCAO Constraints** в system prompt AI Agent — третий, мягкий слой.

Лог отказа на -50 — в записи screencast'а; альтернативно `python homework\M5\simulate_wf1.py --include-invalid` гонит 14% запросов с `-50`, в stdout видно `status=400 success=False`.

## Как запустить

Три параллельных PowerShell-окна (любой порядок старта; все из корня репо):

```powershell
# Окно 1 — n8n (UI на :5678)
$env:N8N_USER_FOLDER = "$PWD\n8n-data"
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$PWD\homework\M5"
n8n start
```

```powershell
# Окно 2 — MCP feature-flags в HTTP-режиме (:5680/mcp)
npm run start:http --prefix mcp-feature-flags
```

```powershell
# Окно 3 — симулятор логов для WF2 (sine error rate)
python homework\M5\simulate_wf2.py --duration 600 --period 120
```

Опционально, для теста галлюцинаций WF1 в отдельном окне:

```powershell
$env:N8N_API_KEY = "<ключ из frontend\.env>"
python homework\M5\simulate_wf1.py --include-invalid --duration 120 --interval 10
```

Backend и фронт (если нужен Dashboard для WF1) запускаются отдельно: `npm run dev` из корня — nodemon следит только за `backend/` (см. `nodemonConfig` в `package.json`), чтобы запись `logs.json` симулятором не уводила его в restart-loop.

## Что было сложно

n8n MCP Client Tool в `httpStreamable`-режиме у меня вёл себя как legacy SSE-клиент (только GET с `Accept: text/event-stream`, без POST initialize) — пришлось поднимать **оба** транспорта на одном эндпоинте: `POST /mcp` под Streamable HTTP, `GET /mcp` + `POST /mcp/message?sessionId=...` под SSE. Для HTTP Request ноды добавил отдельный read-only shortcut `GET /feature/:name` без JSON-RPC, потому что голый HTTP-клиент не делает stateful handshake.

Gemini 2.5 Flash отбивает `type: ["x", "null"]` union в схеме Structured Output Parser — известная разница диалектов JSON Schema vs OpenAPI 3.0. После замены на `nullable: true` он начал отбивать **и это** на некоторых полях; в итоге оптимально оказалось вообще выкинуть optional-поля из схемы (`required` остаются, остальное модель может эмитить — парсер игнорит).

Сэндбоксов в n8n оказалось больше, чем сказано в спеке: `NODE_FUNCTION_ALLOW_BUILTIN` (для `require('fs')` в Code Node — обошёл переходом на встроенную ноду чтения файла), `N8N_RESTRICT_FILE_ACCESS_TO` (whitelist путей для file-нод), и community-нода `@n8n/n8n-nodes-langchain` при случайной установке через UI создаёт конфликт регистраторов с уже встроенной (`Node loader already registered`).

## Бонусы

Не делал — фокус был на доведении основного flow до конца через все sandbox-уровни. В будущем интересно сделать **HITL Wait-ноду** перед `set_feature_state="Disabled"` (Approve/Decline через Telegram-кнопку) — это естественное расширение WF2 для production-сценария.

---

## Setup notes — для воспроизведения сборки

Ниже — операционные детали, которых нет в спеке или которые отличаются от неё в нашей реализации.

### Локальный n8n

n8n хранит **всё** (owner-аккаунт, sqlite БД, workflows, креды) в одной папке. Мы привязываем её к проекту через `N8N_USER_FOLDER`. Без этой переменной n8n создаст новый инстанс в `%USERPROFILE%\.n8n` — workflow'ы и аккаунт «потеряются» (на самом деле просто в другой папке).

Не запускать `n8n start` без переменных — поднимет второй инстанс с нуля. Не редактировать файлы внутри `n8n-data/.n8n/` руками. Не коммитить — папка в `.gitignore`.

### MCP feature-flags — два транспорта

`mcp-feature-flags/server.ts` теперь поддерживает три способа доступа:

| Транспорт | Эндпоинт | Использует |
|---|---|---|
| stdio | n/a | Claude Code (конфиг в `.mcp.json`) |
| Streamable HTTP | `POST /mcp` | MCP-клиенты, которые делают proper handshake |
| Legacy SSE | `GET /mcp` + `POST /mcp/message?sessionId=...` | n8n MCP Client Tool |
| REST shortcut | `GET /feature/:name` | n8n HTTP Request ноды (без MCP) |

Запуск HTTP-режима: `npm run start:http --prefix mcp-feature-flags`. Stdio (по умолчанию) — `npm start --prefix mcp-feature-flags`.

В ноде MCP Client Tool заполнить:

| Поле | Значение |
|---|---|
| Server Transport | `Server Sent Events (Deprecated)` или `HTTP Streamable` — оба работают |
| SSE Endpoint | `http://localhost:5680/mcp` |
| Authentication | None |
| Tools to Include | All |

После Save нода покажет 4 тула: `get_feature_info`, `set_feature_state`, `adjust_traffic_rollout`, `list_features`.

### Имена параметров MCP отличаются от спеки

| В спеке M5 | В нашем MCP |
|---|---|
| `feature_id` | `feature_name` |
| `set_feature_state(target_state="Testing")` | `set_feature_state({feature_name, state: "Testing"})` |
| `adjust_traffic_rollout(traffic_percentage=25)` | `adjust_traffic_rollout({feature_name, percentage: 25})` |

GCAO-промт WF2 написан под наши настоящие имена, агент в WF1 подстраивается по `description` тулов.

### CC-агенты (D-блок спеки)

`.claude/agents/n8n-requirements-orchestrator.md` и `.claude/agents/n8n-workflow-builder.md` пришли пустыми (status PLACEHOLDER в frontmatter, спека говорила «финальная версия будет добавлена автором курса»). Дописал оба самостоятельно с полными system prompt'ами под Claude Code subagent формат. WF2 действительно собран через цепочку: orchestrator (m5-spec.md B.1–B.4 → wf2-spec.yaml) → builder (yaml → wf2-scheduled-monitor.json).

### simulate_wf1.py — нагрузочный dispatcher

Гонит цикл `check → test → rollout → rollback`, `traffic_percentage` ходит по синусоиде между 10 и 90. Флаг `--include-invalid` каждый 7-й запрос подмешивает `traffic_percentage: -50`.

```powershell
$env:N8N_API_KEY = "<ключ>"
python homework\M5\simulate_wf1.py --duration 60 --interval 5
python homework\M5\simulate_wf1.py --include-invalid --duration 120
```

WF1 должен быть **Active** в n8n (production webhook на `/webhook/...`); test-URL `/webhook-test/...` пригоден только для одного ручного запуска из редактора.

### simulate_wf2.py — генератор логов

Пишет события `success` / `error` в `logs.json` с синусоидальным error rate. `--rps 5`, период 300с, амплитуда 10%, baseline 5% по умолчанию.

```powershell
python homework\M5\simulate_wf2.py                          # 30 минут, 5-мин период
python homework\M5\simulate_wf2.py --duration 600 --period 120   # быстрый прогон ~5 циклов
```

Файл бесконечно не растёт — скрипт держит последние 10 000 событий.
