# Модуль 5 — Домашнее задание

> **Тема:** Агенты и n8n. Замыкаем full-stack: M3 (руки / MCP) + M4 (глаза / Dashboard) + M5 (мозг / Agent).
> **Сложность:** Middle+ (n8n визуально + базовые правки фронта) / Senior+ (полный стек с self-host n8n + Telegram + auth).
> **Время:** ~4-6 часов (WF1 manual: 2 ч, WF2 scheduled: 1.5-2 ч, тест на галлюцинации: 30 мин, README + screencast: 30 мин).
> **Дедлайн:** объявляется отдельно перед стартом M6.
> **Куда сдавать:** PR в ваш форк `proshop_mern` — папка `homework/M5/` + правки во `frontend/`. Ссылка в LMS / чат курса.

---

## TL;DR — что нужно сделать

Построить **два n8n-workflow** на сквозном проекте `proshop_mern`:

- **WF1. Manual trigger из Dashboard.** Расширяете Feature Dashboard из M4: добавляете кнопки управления → клик отправляет POST на webhook n8n (с auth-header) → AI Agent через MCP-сервер из M3 принимает решение и крутит ручки → UI обновляется и показывает сообщение от агента («Готово, фича в Testing» / «Не могу отключить, фича уже Disabled» / «Получены некорректные параметры»).
- **WF2. Scheduled defensive monitor.** Cron каждую минуту проверяет имитацию логов трафика (`logs.json`). Симулятор пишет туда события `success` / `error` с **синусоидальным** error rate. Когда error_rate > threshold — агент деактивирует фичу через MCP + шлёт алерт в Telegram. Когда error_rate уходит ниже threshold — re-enable. Студент видит **полный цикл** auto-toggling включается/отключается/включается/отключается.

Плюс **тест на галлюцинации** — POST с `traffic_percentage: -50` отвергается на Switch-ноде и JSON Schema, а не «на здравом смысле LLM». Это и есть Algorithm-before-AI.

Плюс **два Python-симулятора** — оба используют синусоиду для генерации параметров. Это позволяет видеть переход через threshold, реальную динамику нагрузки и валидацию защит.

Плюс **2-3 промпта для Claude Code** — как воспользоваться `n8n-requirements-orchestrator` (превращает идею в спек) и `n8n-workflow-builder` (превращает спек в JSON). Опционально третий — деплой через n8n MCP без копи-пасты в UI.

**Без advanced со звёздочкой.** Все делают одну и ту же базу. Бонусы (HITL, Langfuse, multi-agent) — для портфолио, не для оценки.

---

## Чему учимся

- Анатомии production-агента: GCAO в system prompt + Structured Output на каждом шаге + Algorithm-before-AI (4 слоя guards).
- Связке UI ↔ Agent ↔ MCP — full-stack замкнутый цикл на собственном проекте.
- Двум production-сценариям сразу: manual (синхронный, человек инициирует) + scheduled (асинхронный, агент инициирует сам).
- Использовать Claude Code не только для написания кода, но и для построения workflow — два специализированных субагента на этом курсе.
- Защищать webhook (auth) и понимать почему «промт «не делай X» — не защита».

---

## Что должно работать ДО старта (pre-requisites)

| Компонент | Что должно быть готово | Как проверить |
|---|---|---|
| MCP-сервер из M3 | 3 tools: `get_feature_info`, `set_feature_state`, `adjust_traffic_rollout`. JSON Schema с `enum` / `min` / `max` / `required` на параметрах | `curl https://your-mcp.com/health` → 200 OK. `mcp-inspector list` → 3 tools |
| Feature Dashboard из M4 | Список фич, status badges, toggle / slider. Хотя бы одна тестовая фича типа `search_v2` | Открыть Dashboard в браузере → видны фичи |
| n8n инстанс | Cloud free tier (https://app.n8n.io), self-host docker, или n8n-install (https://github.com/kossakovsky/n8n-install) | Открыть `http://localhost:5678` или cloud URL → видно UI редактора |
| Telegram-бот | Создан через @BotFather, токен сохранён в n8n credentials, chat_id найден | Webhook curl `getMe` → `{"ok": true, "result": {...}}` |
| Python 3.10+ | Для запуска симуляторов (используется `requests`, `numpy`, `math`) | `python3 --version` → 3.10+ |
| Claude Code | Для использования двух M5-субагентов: `n8n-requirements-orchestrator` + `n8n-workflow-builder` | `ls ~/.claude/agents \| grep n8n` → 2 файла (`.md`) |

### Если у вас в M3 нет JSON Schema валидации диапазонов

**Добавьте сейчас.** Без неё тест на галлюцинации (`traffic_percentage: -50`) пройдёт по второму слою защиты только через Switch-ноду, а не через MCP. Для production-уровня domashki нужны оба слоя (defense in depth).

Пример FastMCP:

```python
from typing import Annotated
from pydantic import Field

@mcp.tool()
def adjust_traffic_rollout(
    feature_id: str,
    traffic_percentage: Annotated[int, Field(ge=0, le=100)],  # min/max в схеме
) -> dict:
    """Устанавливает процент трафика для feature flag."""
    ...
```

---

## Карта папки сдачи

После прохождения домашки в форке `proshop_mern` должно быть:

```
proshop_mern/
├── frontend/src/
│   ├── screens/FeatureDashboardScreen.js   ← расширен блоком «Auto-Pilot Controls»
│   └── components/AutoPilotControls.jsx    ← новый компонент (или inline в screen)
└── homework/M5/
    ├── README.md                       ← краткий отчёт + архитектура + что выбрали
    ├── wf1-manual-trigger.json         ← n8n workflow JSON export
    ├── wf2-scheduled-monitor.json      ← n8n workflow JSON export
    ├── simulate_wf1.py                 ← клиент-симулятор для тестов WF1 (sine traffic %)
    ├── simulate_wf2.py                 ← log-генератор для WF2 (sine error rate)
    ├── logs.json                       ← пример накопленных событий (после прогона simulate_wf2)
    ├── trace-wf1.png                   ← скриншот n8n executions WF1 (видно reasoning агента)
    ├── trace-wf2-toggle.png            ← скриншот WF2 (срабатывание + re-enable)
    └── screencast.mp4 (или ссылка)     ← 3-5 минут демо полного цикла
```

---

# Часть A. WF1 — Manual trigger из Dashboard

> ~2 часа. Расширение фронта + n8n workflow + auth + GCAO промт + симулятор-dispatcher.

## A.1 Что должно получиться (ASCII схема)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Feature Dashboard (proshop_mern, M4)                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  Auto-Pilot Controls для search_v2                                     │  │
│  │   [Запустить проверку]  [Тестовый режим]  [Откатить фичу]              │  │
│  │   loading: false        error: null       result: "Готово, в Testing"  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────┬───────────────────────────────────────────────────────────────────┘
           │  POST {{VITE_N8N_WEBHOOK_URL}}/feature-control
           │  Headers: { "Content-Type": "application/json",
           │             "X-API-Key": {{VITE_N8N_API_KEY}} }
           │  Body: { "feature_id": "search_v2",
           │          "action": "test",
           │          "target_state": "Testing" }
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  N8N WORKFLOW: wf1-manual-trigger                                            │
│                                                                              │
│  ┌──────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐ │
│  │ Webhook      │───▶│ Switch           │───▶│ AI Agent (Tools Agent)      │ │
│  │ Trigger      │    │ - tp < 0  > 100  │    │ ┌─────────────────────────┐ │ │
│  │ POST         │    │ - feature_id?    │    │ │ Chat Model              │ │ │
│  │ /feature-    │    │ - target_state?  │    │ │ (Claude / GPT / Gemini) │ │ │
│  │  control     │    │ - action?        │    │ └─────────────────────────┘ │ │
│  │              │    │ - else → AI      │    │ ┌─────────────────────────┐ │ │
│  │ Auth:        │    │                  │    │ │ Memory                  │ │ │
│  │ Header       │    │ → если bad →     │    │ │ Window Buffer length=5  │ │ │
│  │ X-API-Key    │    │   Respond 400    │    │ └─────────────────────────┘ │ │
│  └──────────────┘    └──────────────────┘    │ ┌─────────────────────────┐ │ │
│                                              │ │ Tools: MCP Client Tool  │ │ │
│                                              │ │ (M3 MCP: 3 tools)       │ │ │
│                                              │ └─────────────────────────┘ │ │
│                                              │ ┌─────────────────────────┐ │ │
│                                              │ │ System Prompt: GCAO     │ │ │
│                                              │ │ (см. A.5)               │ │ │
│                                              │ └─────────────────────────┘ │ │
│                                              │ ┌─────────────────────────┐ │ │
│                                              │ │ Structured Output Parser│ │ │
│                                              │ │ JSON schema             │ │ │
│                                              │ └─────────────────────────┘ │ │
│                                              └──────────────┬──────────────┘ │
│                                                             │                │
│                                              ┌──────────────▼──────────────┐ │
│                                              │ Respond to Webhook          │ │
│                                              │ JSON: { success, message,   │ │
│                                              │   current_state }           │ │
│                                              └──────────────┬──────────────┘ │
└────────────────────────────────────────────────────────────┼─────────────────┘
                                                             │
                                                             ▼
       ┌──────────────────────────────────────────────────────────────────────┐
       │  FRONTEND обновляет UI:                                              │
       │  - status badge: Enabled → Testing (зелёный → синий)                 │
       │  - traffic slider: 0% → 0%                                           │
       │  - alert: «Готово, фича в Testing»                                   │
       │  - на success=false: красный alert с message от агента               │
       └──────────────────────────────────────────────────────────────────────┘
```

## A.2 Шаг 1 — расширить Feature Dashboard из M4

В `FeatureDashboardScreen.js` (или ваш аналог) добавьте блок **«Auto-Pilot Controls»** — отдельная карточка с 3 кнопками для **выбранной** фичи.

### env-переменные

В `.env` фронтенда:

```bash
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
VITE_N8N_API_KEY=replace-me-with-strong-random-string
```

> Для production `VITE_N8N_API_KEY` **не должен** оказываться в build (фронт открыт). Это ОК для домашки, но в реальной системе frontend дёргает свой собственный backend, а тот уже шлёт authenticated request на n8n. На M5 упрощаем — auth остаётся на фронте.

### React snippet (под proshop_mern stack)

```jsx
// frontend/src/components/AutoPilotControls.jsx

import { useState } from 'react';

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;
const N8N_API_KEY = import.meta.env.VITE_N8N_API_KEY;

export default function AutoPilotControls({ feature, onUpdate }) {
  const [loading, setLoading] = useState(null);   // null | 'check' | 'test' | 'rollback'
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  async function callAutoPilot(action, extras = {}) {
    setLoading(action);
    setFeedback(null);

    try {
      const response = await fetch(`${N8N_URL}/feature-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': N8N_API_KEY,
        },
        body: JSON.stringify({
          feature_id: feature.id,
          action,
          ...extras,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        setFeedback({ type: 'error', message: result.message || `HTTP ${response.status}` });
        return;
      }

      setFeedback({ type: 'success', message: result.message });
      onUpdate(result.current_state);
    } catch (e) {
      setFeedback({ type: 'error', message: `Сеть: ${e.message}` });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card auto-pilot-controls" aria-label="Auto-Pilot Controls">
      <h3>Auto-Pilot для {feature.name}</h3>

      <div className="button-row">
        <button
          onClick={() => callAutoPilot('check')}
          disabled={loading !== null}
        >
          {loading === 'check' ? 'Проверяем…' : 'Запустить проверку'}
        </button>

        <button
          onClick={() => callAutoPilot('test', { target_state: 'Testing' })}
          disabled={loading !== null}
        >
          {loading === 'test' ? 'Включаем…' : 'Тестовый режим'}
        </button>

        <button
          onClick={() => callAutoPilot('rollback', { target_state: 'Disabled' })}
          disabled={loading !== null}
          className="btn-danger"
        >
          {loading === 'rollback' ? 'Откатываем…' : 'Откатить фичу'}
        </button>
      </div>

      {feedback && (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.message}
        </div>
      )}
    </div>
  );
}
```

### Использование в основном экране

```jsx
import AutoPilotControls from '../components/AutoPilotControls';

function FeatureDashboardScreen() {
  const [features, setFeatures] = useState([]);
  const [selectedFeature, setSelectedFeature] = useState(null);

  function handleFeatureUpdate(newState) {
    setFeatures(prev => prev.map(f => (f.id === newState.id ? { ...f, ...newState } : f)));
  }

  return (
    <div>
      <FeaturesTable features={features} onSelect={setSelectedFeature} />
      {selectedFeature && (
        <AutoPilotControls feature={selectedFeature} onUpdate={handleFeatureUpdate} />
      )}
    </div>
  );
}
```

### Vue / Svelte эквиваленты

Паттерн идентичен:
1. Composable / store для `loading`, `feedback`, `currentState`
2. Async-функция `callAutoPilot(action, extras)` с fetch на `VITE_N8N_WEBHOOK_URL` + header `X-API-Key`
3. На ответ — обновить store / state

## A.3 Шаг 2 — настроить auth на webhook (X-API-Key)

В n8n webhook должен принимать **только** запросы с правильным header'ом.

### В n8n UI

1. Settings → Credentials → New → **Header Auth**
2. Name: `n8n-feature-control-api-key`
3. Header Name: `X-API-Key`
4. Header Value: сгенерируйте длинный random string (`openssl rand -hex 32`)
5. Save

### Привязать к Webhook-ноде

1. В вашем WF1 откройте Webhook Trigger ноду
2. **Authentication:** Header Auth
3. **Credential to Use:** выбрать созданный `n8n-feature-control-api-key`
4. Save

### На фронтенде

В `.env` (см. выше) положите тот же `X-API-Key` в `VITE_N8N_API_KEY`. Фронт автоматически шлёт его в каждом fetch.

### Проверка

```bash
# Без header — должно отказать
curl -X POST https://your-n8n.com/webhook/feature-control \
  -H "Content-Type: application/json" \
  -d '{"feature_id":"search_v2","action":"check"}'
# Ожидаемый ответ: 403 Forbidden

# С header — должно пройти
curl -X POST https://your-n8n.com/webhook/feature-control \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key-here" \
  -d '{"feature_id":"search_v2","action":"check"}'
# Ожидаемый ответ: 200 OK с JSON от агента
```

### Production caveat

В реальной системе `X-API-Key` лежит не на фронте, а в backend'е, который дёргает n8n за пользователя. Фронт никогда не видит ключ. Для M5 это упрощение — сделайте отметку об этом в README.

## A.4 Шаг 3 — собрать workflow в n8n

> 📌 **Важно про AI Agent + sub-nodes.** В n8n AI Agent — это **одна нода с подключёнными sub-nodes** (Memory, Tools, Output Parser, Chat Model), не линейная цепочка. Sub-nodes подключаются к AI Agent через **разные типы connections**:
>
> ```
> ┌─────────────────────┐
> │ Chat Model          │ ──ai_languageModel──┐
> └─────────────────────┘                     │
> ┌─────────────────────┐                     │
> │ Window Buffer       │ ──ai_memory─────────┤
> │ Memory              │                     │
> └─────────────────────┘                     ├──▶ [ AI Agent ] ──main──▶ Respond
> ┌─────────────────────┐                     │
> │ MCP Tool / HTTP Tool│ ──ai_tool───────────┤
> └─────────────────────┘                     │
> ┌─────────────────────┐                     │
> │ Output Parser       │ ──ai_outputParser───┘
> └─────────────────────┘
> ```
>
> В UI они **внутри** AI Agent ноды (раскрываются над/под основной нодой). Это критично знать когда смотрите JSON workflow или используете `n8n-workflow-builder` — connections object имеет отдельные ключи `ai_memory`, `ai_tool`, `ai_outputParser`, `ai_languageModel` помимо обычного `main`.

### Главные ноды в основной цепочке

1. **Webhook Trigger** (`n8n-nodes-base.webhook`)
   - HTTP Method: `POST`
   - Path: `feature-control`
   - Authentication: `Header Auth` → ваш credential `n8n-feature-control-api-key`
   - Response Mode: `Using 'Respond to Webhook' Node` (важно!)

2. **Switch — Input Validation** (`n8n-nodes-base.switch`, n8n 2.x)
   > ⚠️ В n8n 2.x Switch работает в режиме **`rules`** (не expression-mode из старых версий). Каждое правило — набор `conditions` с `leftValue` / `operator` / `rightValue`. Чистое expression вида `{{ $json.x === undefined }}` как **самостоятельного правила** не работает — это будет literal-строка.

   - Mode: **`rules`**
   - Add fallback output: **включить** (Options → Fallback Output → Extra output)
   - 4 правила (каждое → output 0/1/2/3, fallback → output 4 → AI Agent):

   | # | outputKey | leftValue | operator | rightValue |
   |---|---|---|---|---|
   | 0 | `missing_feature_id` | `={{ $json.feature_id }}` | string · isEmpty | — |
   | 1 | `missing_action` | `={{ $json.action }}` | string · isEmpty | — |
   | 2 | `invalid_action` | `={{ ['check','test','rollback','rollout'].includes($json.action) }}` | boolean · equals | `false` |
   | 3 | `invalid_traffic` | `={{ $json.traffic_percentage !== undefined && ($json.traffic_percentage < 0 \|\| $json.traffic_percentage > 100) }}` | boolean · equals | `true` |

   Каждый reject-output (0-3) подключите к **общему Respond to Webhook (400)** с body:
   ```json
   {"success": false, "message": "Validation error", "rejected_at": "input-validation"}
   ```

3. **AI Agent — Tools Agent** (`@n8n/n8n-nodes-langchain.agent`, typeVersion 3)
   - **Подключён к** fallback output Switch (`main[4]`)
   - **В UI Options блок:**
     - **System Message:** `=` + ваш GCAO из A.5 (см. ниже — обязателен знак `=` перед `{{ }}` чтобы это была expression, не literal)
     - **Max Iterations:** `5`
   - **В JSON:** `parameters.options.systemMessage`, `parameters.options.maxIterations`
   - **Подключите 4 sub-node** (см. ниже)

4. **Sub-nodes к AI Agent** (создаются как отдельные ноды, но **в UI они внутри AI Agent**)

   **a) Chat Model** (любой, ваш выбор)
   - Claude / GPT / Gemini / OpenRouter
   - Connection: `ai_languageModel` → AI Agent
   - В JSON: `connections.{ChatModelName}.ai_languageModel[0][0]` = `{node: "AI Agent", type: "ai_languageModel", index: 0}`

   **b) Window Buffer Memory** (`@n8n/n8n-nodes-langchain.memoryBufferWindow`)
   - **Parameters:**
     - `contextWindowLength`: `5`
     - `sessionIdType`: **`customKey`** (важно!)
     - `sessionKey`: `={{ $json.feature_id }}` (привязка памяти к feature_id, не к execution)
   - Connection: `ai_memory` → AI Agent
   > Без `sessionKey` каждый webhook-запрос получает новый sessionId — память бесполезна. Привязка к `feature_id` даёт «накопительную» сессию для каждой фичи.

   **c) Tools — два варианта**

   **Вариант 1 (рекомендуемый):** MCP Client Tool (`@n8n/n8n-nodes-langchain.toolMcp`)
   - ⚠️ **Это community node, не входит в стандартный n8n.** Установка: Settings → Community Nodes → ввести `@n8n/n8n-nodes-langchain` → Install
   - Parameters:
     - SSE Endpoint: `{{YOUR_M3_MCP_SERVER_URL}}/sse`
     - Authentication: Bearer Token (creds из M3)
     - Tools to Include: `all`
   - Connection: `ai_tool` → AI Agent

   **Вариант 2 (если community nodes не разрешены):** HTTP Request Tool (`n8n-nodes-base.httpRequestTool`)
   - Встроенная нода, не требует установки
   - Создайте 3 отдельные httpRequestTool ноды — по одной на каждый MCP tool (get_feature_info / set_feature_state / adjust_traffic_rollout)
   - В name + description каждой ноды чётко напишите что она делает (LLM решает по описанию)
   - Каждая ноду через `ai_tool` → AI Agent

   **d) Structured Output Parser** (`@n8n/n8n-nodes-langchain.outputParserStructured`)
   - Parameters:
     - `schemaType`: `manual`
     - `inputSchema`:
       ```json
       {
         "type": "object",
         "required": ["success", "message"],
         "properties": {
           "success": {"type": "boolean"},
           "message": {"type": "string"},
           "current_state": {
             "type": ["object", "null"],
             "properties": {
               "id": {"type": "string"},
               "name": {"type": "string"},
               "status": {"type": "string", "enum": ["Enabled", "Disabled", "Testing"]},
               "traffic_percentage": {"type": "number"},
               "last_modified": {"type": "string"}
             }
           },
           "rejected_at": {"type": ["string", "null"]}
         }
       }
       ```
   - Connection: `ai_outputParser` → AI Agent
   > ⚠️ **Гибрид с Tools Agent.** Когда подключён outputParser, агент обязан вернуть JSON по схеме. Это может конфликтовать с tool calling (агент хочет вызвать tool — но parser требует финальный JSON). В GCAO из A.5 явно написано «верни JSON по схеме» — этого достаточно, на проверенных live workflows работает. Если будут проблемы — уберите Parser и валидируйте JSON в Code Node после AI Agent.

5. **Respond to Webhook (200)** (`n8n-nodes-base.respondToWebhook`)
   - Подключён к `main[0]` AI Agent
   - Respond With: `json`
   - Response Body: `={{ $json }}`
   - Response Code: `200` (фронт смотрит на `success` поле в body)

### CORS gotcha

Если фронт на другом origin (Vercel / Netlify / любой production frontend) — добавьте в Webhook Trigger → Options → **Response Headers**:

```
Access-Control-Allow-Origin: https://your-frontend.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-API-Key
```

Если оба на `localhost` — CORS не нужен.

### Локальная разработка (n8n self-host + фронт на Vercel)

Webhook должен быть доступен снаружи. Три варианта:
- **n8n cloud** — `VITE_N8N_WEBHOOK_URL=https://your-account.app.n8n.cloud/webhook`
- **ngrok** — `ngrok http 5678` → используйте URL формата `https://abcd-1234.ngrok-free.app/webhook`
- **Cloudflare Tunnel** — `cloudflared tunnel --url http://localhost:5678`

## A.5 Шаг 4 — GCAO system prompt для WF1

**GCAO** — production-стандарт для system prompt: **G**oal / **C**ontext / **A**ction / **O**utput (+ опционально Constraints).

Вставьте этот текст в AI Agent ноде → System Prompt поле:

```
Goal:
Выполни запрос пользователя по управлению feature flag {{$json.feature_id}}.

Context:
- Текущее состояние feature flag получи через get_feature_info ПЕРЕД любыми изменениями.
- Команда от UI: action={{$json.action}}, target_state={{$json.target_state}}, traffic_percentage={{$json.traffic_percentage}}.
- Доступные actions: "check" (только чтение), "test" (перевести в Testing), "rollback" (Disabled), "rollout" (изменить traffic_percentage).
- Available tools: get_feature_info, set_feature_state, adjust_traffic_rollout.

Action:
1. Если action="check" — вызови get_feature_info и верни результат.
2. Если action="test" — get_feature_info → проверь что фича не Enabled → set_feature_state(Testing) → get_feature_info для верификации.
3. Если action="rollback" — get_feature_info → если уже Disabled, верни no_op → иначе set_feature_state(Disabled) → get_feature_info.
4. Если action="rollout" — get_feature_info → adjust_traffic_rollout(traffic_percentage) → get_feature_info.
5. На любом шаге если invalid params (например, traffic_percentage не передан для action="rollout") — верни ошибку без вызова инструментов.

Output:
JSON строго по схеме:
{
  "success": boolean,
  "message": string (краткое описание результата на русском, 1 предложение),
  "current_state": {
    "id": string,
    "name": string,
    "status": "Enabled" | "Disabled" | "Testing",
    "traffic_percentage": number,
    "last_modified": string (ISO 8601)
  } | null,
  "rejected_at": "input-validation" | "tool-execution" | null
}

Constraints:
- traffic_percentage в диапазоне [0, 100]. Если получен -50 или 150 — отказ с message объяснения.
- target_state из enum [Enabled, Disabled, Testing]. Если другое — отказ.
- НЕ вызывай set_feature_state повторно если current_state.status уже соответствует целевому.
- Если ошибка от MCP-инструмента — верни success=false с message от инструмента.
```

> ⚠️ **Помните:** Constraints в промте — рекомендация, не закон. Реальная защита от `-50` живёт в Switch-ноде + JSON Schema на MCP. Промт — это **дополнительный** слой, не основной. См. Appendix B.

### Как попросить Claude Code помочь с этим промтом

Если нужен свой вариант GCAO под другую фичу / другой набор tools:

```
prompt:
Помоги написать GCAO system prompt для AI Agent ноды в n8n.

Контекст:
- Я строю WF1 — webhook принимает POST с {feature_id, action, target_state, traffic_percentage}.
- Агент использует MCP с 3 tools: get_feature_info, set_feature_state, adjust_traffic_rollout.
- Возвращает JSON: {success, message, current_state, rejected_at}.

Особенности моей фичи: [опишите — например, "search_v2 — production-критичная, rollback требует особой осторожности"]

Сгенерируй GCAO в 4 блока + Constraints. Action — пронумерованным списком шагов.
После — объясни, что в Constraints — рекомендация, а где живёт реальный guard (Switch + JSON Schema).
```

## A.6 Шаг 5 — симулятор WF1 dispatcher (`simulate_wf1.py`)

Этот скрипт **автоматически дёргает ваш webhook WF1** с разными командами по таймеру. Используется для:
- Дымового теста: всё ли работает после правок
- Демонстрации в screencast: видно как агент реагирует на серию команд
- Стресс-теста: что если 10 команд подряд

`traffic_percentage` меняется по **синусоиде** — `50 + 40 * sin(t)`. Это позволяет видеть как агент обрабатывает граничные значения (10%, 50%, 90%) и не-граничные (промежуточные).

```python
#!/usr/bin/env python3
"""
simulate_wf1.py — dispatcher для WF1 manual trigger workflow.

Дёргает webhook n8n WF1 по таймеру разными командами. traffic_percentage
меняется по синусоиде. Опционально шлёт намеренно невалидные команды
для теста галлюцинаций.

Usage:
    python3 simulate_wf1.py --webhook-url https://your-n8n.com/webhook --api-key XXX
    python3 simulate_wf1.py ... --duration 120 --interval 10
    python3 simulate_wf1.py ... --include-invalid
"""

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime

import requests


def run(
    webhook_url: str,
    api_key: str,
    feature_id: str,
    duration: float,
    interval: float,
    include_invalid: bool,
) -> None:
    """Runs the WF1 dispatcher loop."""
    start = time.time()
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
    }

    # Цикл команд (sine-driven rotation).
    actions_cycle = ["check", "test", "rollout", "check", "rollback", "check"]
    iteration = 0

    while time.time() - start < duration:
        t = time.time() - start

        # Sine-wave traffic_percentage между 10 и 90 с периодом 60s
        traffic_percentage = int(50 + 40 * math.sin(2 * math.pi * t / 60))
        # Sine modulates action choice
        action = actions_cycle[iteration % len(actions_cycle)]

        payload = {
            "feature_id": feature_id,
            "action": action,
        }
        if action == "rollout":
            payload["traffic_percentage"] = traffic_percentage
        elif action in ("test", "rollback"):
            payload["target_state"] = "Testing" if action == "test" else "Disabled"

        # Каждый 7-й запрос — намеренно невалидный (тест галлюцинаций)
        if include_invalid and iteration > 0 and iteration % 7 == 0:
            payload["traffic_percentage"] = -50  # должен быть отвергнут на Switch
            payload["action"] = "rollout"
            print(f"[{datetime.now().isoformat()}] [INVALID test] payload={payload}")
        else:
            print(f"[{datetime.now().isoformat()}] action={action} payload={payload}")

        try:
            r = requests.post(webhook_url, headers=headers, json=payload, timeout=30)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"raw": r.text}
            print(f"  → status={r.status_code} success={data.get('success')} message={data.get('message')}")
        except requests.exceptions.RequestException as e:
            print(f"  → network error: {e}", file=sys.stderr)

        iteration += 1
        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF1 dispatcher simulator")
    p.add_argument("--webhook-url", required=True, help="Full URL of /feature-control webhook")
    p.add_argument("--api-key", default=os.environ.get("N8N_API_KEY", ""), help="X-API-Key header value (or env N8N_API_KEY)")
    p.add_argument("--feature-id", default="search_v2", help="Target feature_id (default: search_v2)")
    p.add_argument("--duration", type=float, default=120, help="Run for N seconds (default: 120)")
    p.add_argument("--interval", type=float, default=10, help="Seconds between requests (default: 10)")
    p.add_argument("--include-invalid", action="store_true", help="Send hallucination-test payloads (-50) каждый 7-й запрос")
    args = p.parse_args()

    if not args.api_key:
        sys.exit("X-API-Key не задан: --api-key или env N8N_API_KEY")

    print(f"Запуск simulate_wf1.py — duration={args.duration}s, interval={args.interval}s")
    print(f"Webhook: {args.webhook_url}")
    print(f"Feature: {args.feature_id}, include_invalid={args.include_invalid}")
    print("---")

    run(
        webhook_url=args.webhook_url,
        api_key=args.api_key,
        feature_id=args.feature_id,
        duration=args.duration,
        interval=args.interval,
        include_invalid=args.include_invalid,
    )

    print("---\nЗавершено.")


if __name__ == "__main__":
    main()
```

### Запуск

```bash
# Базовый прогон 2 минуты, шаг 10 секунд
N8N_API_KEY="your-key-here" \
python3 simulate_wf1.py \
  --webhook-url "https://your-n8n.com/webhook/feature-control" \
  --duration 120 \
  --interval 10

# С галлюцинационными запросами (для теста защит)
... --include-invalid
```

## A.7 Проверка WF1

- [ ] В Dashboard виден блок «Auto-Pilot Controls» с 3 кнопками
- [ ] Клик «Тестовый режим» → бордюр статус-бейджа меняется через 2-3 секунды
- [ ] При успешной операции — alert «Готово, фича в Testing»
- [ ] При попытке `rollback` уже-disabled фичи — agent возвращает `success: true, message: "Фича уже Disabled"` (no_op)
- [ ] curl без `X-API-Key` → 403
- [ ] curl с правильным `X-API-Key` + валидный payload → 200 + JSON
- [ ] `simulate_wf1.py --include-invalid` — видно отказы на `-50`, успешные операции на валидных
- [ ] В n8n executions trace видно цепочку: Webhook → Switch → AI Agent (с reasoning) → Respond
- [ ] Switch настроен в режиме `rules` (не expression), 4 правила + fallback output
- [ ] Sub-nodes AI Agent подключены через правильные types: `ai_languageModel`, `ai_memory`, `ai_tool`, `ai_outputParser` (видно в JSON workflow при export)
- [ ] Window Buffer Memory имеет `sessionKey = $json.feature_id` (иначе бесполезна)
- [ ] AI Agent ноде включены `Verbose` и `Return Intermediate Steps` — иначе trace будет беден

---

# Часть B. WF2 — Scheduled defensive monitor

> ~1.5-2 часа. Симулятор-генератор логов с синусоидой + n8n cron workflow + Telegram alert + GCAO + re-enable.

## B.1 Что должно получиться (ASCII схема)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PYTHON: simulate_wf2.py (запущен фоном)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Sine error rate: amplitude 0.10, baseline 0.05, period 5 минут      │    │
│  │ → error_rate(t) = max(0, 0.05 + 0.10 * sin(2π·t/300))               │    │
│  │ → каждую секунду пишет N событий success/error в logs.json          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└────────────┬────────────────────────────────────────────────────────────────┘
             │ append
             ▼
       ┌────────────────────┐
       │ logs.json          │
       │ [{ts, fid, status}]│
       └────────┬───────────┘
                │ read
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  N8N WORKFLOW: wf2-scheduled-monitor (cron каждую минуту)                   │
│                                                                             │
│  ┌──────────────┐   ┌──────────────────────────┐                            │
│  │ Schedule     │──▶│ Code Node                │                            │
│  │ Trigger      │   │ - read logs.json         │                            │
│  │ every 1 min  │   │                          │                            │
│  └──────────────┘   │ - filter last 60s        │                            │
│                     │ - count errors / total   │                            │
│                     │ - error_rate, total      │                            │
│                     └──────────┬───────────────┘                            │
│                                ▼                                            │
│                    ┌─────────────────────────────────────────┐              │
│                    │ HTTP Request: get_feature_info (M3 MCP) │              │
│                    │ → current.status                        │              │
│                    └──────────┬──────────────────────────────┘              │
│                               ▼                                             │
│                    ┌─────────────────────────────────────────────────────┐  │
│                    │ Switch (4-way decision)                             │  │
│                    │  ├─ error_rate > 5% AND status != "Disabled"        │  │
│                    │  │   → AI Agent (deactivate + alert) ─┐             │  │
│                    │  ├─ error_rate < 1% AND status == "Disabled"        │  │
│                    │  │   → AI Agent (re-enable + alert)   │             │  │
│                    │  └─ else (within threshold)                         │  │
│                    │      → No-op (log only)                             │  │
│                    └─────────────────────────────────────────┼──────────-┘  │
│                                                              ▼              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ AI Agent (Tools Agent)                                                │  │
│  │  ├─ Chat Model: ваш выбор                                             │  │
│  │  ├─ Memory: Window Buffer length=3 (короткие сессии)                  │  │
│  │  ├─ Tools: get_feature_info, set_feature_state (через MCP M3)         │  │
│  │  ├─ System Prompt: GCAO (см. B.4)                                     │  │
│  │  └─ Structured Output Parser                                          │  │
│  └────────────────────────────────────┬──────────────────────────────────┘  │
│                                       ▼                                     │
│                       ┌──────────────────────────────────┐                  │
│                       │ Telegram Send Message            │                  │
│                       │ → @your_alerts_bot               │                  │
│                       │ → "🚨 search_v2 деактивирована,  │                  │
│                       │    error rate 14%"               │                  │
│                       └──────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## B.2 Шаг 1 — симулятор-генератор логов (`simulate_wf2.py`)

Этот скрипт пишет события `success` / `error` в `logs.json` с error_rate, который меняется по синусоиде. Период — 5 минут. amplitude 10%, baseline 5%. Это значит:
- В минимуме синусоиды error_rate ≈ 0% (фича работает идеально)
- В максимуме error_rate ≈ 15% (критическое)
- Threshold WF2 = 5% — поэтому каждые ~5 минут error_rate проходит через threshold вверх и вниз
- Фича будет автоматически toggleinitially Disabled, потом re-enabled, потом снова Disabled — полный цикл за период синусоиды

```python
#!/usr/bin/env python3
"""
simulate_wf2.py — log generator with sine-wave error rate.

Пишет события success/error в logs.json. error_rate меняется по синусоиде
с конфигурируемым периодом, чтобы WF2 (cron-trigger n8n) видел переход
через threshold туда и обратно — фича автоматически выключается и
включается.

Usage:
    python3 simulate_wf2.py --output logs.json --duration 1800 --period 300
    python3 simulate_wf2.py ... --rps 5 --amplitude 0.10 --baseline 0.05
"""

import argparse
import json
import math
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def sine_error_rate(t: float, period: float, amplitude: float, baseline: float) -> float:
    """Returns instantaneous error_rate at time t.

    error_rate(t) = max(0, min(1, baseline + amplitude * sin(2π·t/period)))
    """
    raw = baseline + amplitude * math.sin(2 * math.pi * t / period)
    return max(0.0, min(1.0, raw))


def run(
    output_path: Path,
    feature_id: str,
    duration: float,
    rps: float,
    period: float,
    amplitude: float,
    baseline: float,
) -> None:
    """Runs the log generator until duration expires."""
    # Если файла нет — создать с пустым массивом
    if not output_path.exists():
        output_path.write_text("[]")

    start = time.time()
    interval = 1.0 / rps

    while time.time() - start < duration:
        t = time.time() - start
        rate = sine_error_rate(t, period, amplitude, baseline)
        status = "error" if random.random() < rate else "success"

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feature_id": feature_id,
            "status": status,
            "error_rate_now": round(rate, 3),  # для отладки — текущая sine точка
        }

        # Append (читаем целиком, добавляем, пишем — для домашки достаточно)
        try:
            existing = json.loads(output_path.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            existing = []

        existing.append(event)
        # Ограничим файл последними 10_000 событиями чтобы он не разнёс диск
        if len(existing) > 10_000:
            existing = existing[-10_000:]
        output_path.write_text(json.dumps(existing, ensure_ascii=False, indent=None))

        # На stdout печатаем редко (раз в 5 секунд), чтобы не спамить
        if int(t) % 5 == 0 and int(t * rps) % int(rps * 5) == 0:
            print(f"t={int(t)}s rate={rate:.1%} status={status} total_events={len(existing)}")

        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF2 log generator (sine error rate)")
    p.add_argument("--output", default="logs.json", help="Path to logs.json (default: ./logs.json)")
    p.add_argument("--feature-id", default="search_v2")
    p.add_argument("--duration", type=float, default=1800, help="Run for N seconds (default: 1800 = 30 min)")
    p.add_argument("--rps", type=float, default=5, help="Events per second (default: 5)")
    p.add_argument("--period", type=float, default=300, help="Sine period in seconds (default: 300 = 5 min)")
    p.add_argument("--amplitude", type=float, default=0.10, help="Sine amplitude (default: 0.10)")
    p.add_argument("--baseline", type=float, default=0.05, help="Sine baseline error_rate (default: 0.05)")
    args = p.parse_args()

    print(f"simulate_wf2.py — duration={args.duration}s, rps={args.rps}, period={args.period}s")
    print(f"sine: baseline={args.baseline:.1%}, amplitude={args.amplitude:.1%} → rate в [{max(0, args.baseline-args.amplitude):.1%}; {min(1, args.baseline+args.amplitude):.1%}]")
    print(f"Threshold WF2 = 5% → фича toggle'ится примерно каждые {args.period/2:.0f}s")
    print(f"Файл: {args.output}")
    print("---")

    run(
        output_path=Path(args.output),
        feature_id=args.feature_id,
        duration=args.duration,
        rps=args.rps,
        period=args.period,
        amplitude=args.amplitude,
        baseline=args.baseline,
    )


if __name__ == "__main__":
    main()
```

### Запуск

```bash
# 30 минут реальных, период sine 5 минут → 6 циклов toggle
python3 simulate_wf2.py --output logs.json --duration 1800 --period 300

# Короткий тест 10 минут, период 2 минуты — быстрее увидеть circle
python3 simulate_wf2.py --duration 600 --period 120
```

### Где хранится logs.json

JSON-файл выбран для простоты. **Если у n8n self-host другой filesystem**:
- Docker — `volume mount`: `-v $(pwd)/logs:/data/logs`, в Code Node читать по `/data/logs/logs.json`
- n8n cloud — нужен другой backend (Postgres / Redis Stream / S3) или прокидывание через HTTP

Альтернативы (если хотите — отметьте в README):
- Postgres-таблица `traffic_events` с теми же полями
- Redis Stream
- S3 + n8n S3 node

## B.3 Шаг 2 — собрать workflow в n8n

### Ноды (по порядку)

1. **Schedule Trigger** (`n8n-nodes-base.scheduleTrigger`) — every 1 minute
   > ⚠️ В docs.n8n.io можно встретить старое название «Cron Trigger» — это устаревший alias. Используйте Schedule Trigger из текущего каталога n8n 2.x.
   - В UI: Trigger Interval → Minutes, Every: 1
   - В JSON: `{"rule": {"interval": [{"field": "minutes", "minutesInterval": 1}]}}`

2. **Code Node** (читает logs)
   ```javascript
   const fs = require('fs');
   const path = '/data/logs/logs.json';  // или ваш путь
   const data = JSON.parse(fs.readFileSync(path, 'utf-8'));

   const now = Date.now();
   const window_ms = 60 * 1000;  // последняя минута
   const recent = data.filter(e => (now - new Date(e.timestamp).getTime()) < window_ms);

   const total = recent.length;
   const errors = recent.filter(e => e.status === 'error').length;
   const error_rate = total > 0 ? errors / total : 0;

   return [{ json: { feature_id: 'search_v2', error_rate, total, errors } }];
   ```

3. **HTTP Request — Get Feature Status** (`n8n-nodes-base.httpRequest`)
   - Method: `POST`
   - URL: `{{YOUR_M3_MCP_SERVER_URL}}/tools/get_feature_info`
   - Body Parameters: `feature_id` = `={{ $('Read & Analyze Logs').item.json.feature_id }}`
   - Authentication: Bearer Token (creds из M3)
   > ⚠️ Прямой HTTP Request на MCP работает **только если ваш M3 сервер выставляет REST endpoints** (как FastAPI / FastMCP с HTTP transport). Если стандартный MCP SSE — либо используйте MCP Client Tool sub-node в AI Agent, либо добавьте HTTP-wrapper в M3.

4. **Code Node — Merge Data** (`n8n-nodes-base.code`)
   > ⚠️ **Обязательный шаг!** Switch в n8n работает с одним входным `$json`, не с cross-node refs. Если Switch попытается читать `$('HTTP Request').item.json.status` из conditions — будет хрупко на multi-item сценариях. Сначала объединяем данные:

   ```javascript
   return [{ json: {
     feature_id: $('Read & Analyze Logs').item.json.feature_id,
     error_rate: $('Read & Analyze Logs').item.json.error_rate,
     total: $('Read & Analyze Logs').item.json.total,
     // current_state.status зависит от API M3 — подставьте ваш путь
     current_status: $('Get Feature Status').item.json.status
                     ?? $('Get Feature Status').item.json.current_state?.status
   }}];
   ```

5. **Switch — Decision** (`n8n-nodes-base.switch`, mode `rules`)
   > Используется тот же `rules` синтаксис что в WF1 (см. A.4 для деталей про rules-формат).

   | # | outputKey | conditions (combinator: `and`) |
   |---|---|---|
   | 0 | `deactivate` | `={{ $json.error_rate }}` · number · `>` · `0.05` **AND** `={{ $json.current_status }}` · string · `notEquals` · `Disabled` |
   | 1 | `reenable` | `={{ $json.error_rate }}` · number · `<` · `0.01` **AND** `={{ $json.current_status }}` · string · `equals` · `Disabled` |

   Options → Fallback Output: **включить** (`extra`) → output 2 → NoOp ноду.

6. **Set Node "Set Decision" (× 2)** (`n8n-nodes-base.set`)
   - Один экземпляр подключён к output 0 (deactivate), другой к output 1 (reenable)
   - Параметр `decision` = `deactivate` / `reenable` соответственно
   - Передаёт `feature_id`, `error_rate`, `current_status` дальше

   Альтернатива: одна Set нода + IF внутри агента. Два Set чище.

7. **AI Agent — Monitor Agent** (`@n8n/n8n-nodes-langchain.agent`, typeVersion 3)
   - **ОДИН агент** (не два!) — принимает оба decision через payload, в промте обрабатывает обе ветки. Two-agent setup оставьте для бонуса.
   - Подключён к main output **обеих** Set нод (через NoOp Merge или прямо двумя входами)
   - **Parameters.options:**
     - `systemMessage`: `=` + GCAO из B.4
     - `maxIterations`: `3`
   - **Sub-nodes:**
     - **Chat Model** → `ai_languageModel`
     - **Memory: НЕ подключать** — cron execution stateless, история между минутами не нужна. Подключить Memory без `sessionKey` = трата токенов на пустую инициализацию.
     - **Tools:** MCP Client Tool или 2 × HTTP Request Tool (get_feature_info + set_feature_state). См. A.4 «c) Tools» для деталей.
     - **Output Parser** (`@n8n/n8n-nodes-langchain.outputParserStructured`):
       ```json
       {
         "type": "object",
         "required": ["action_taken", "alert_message"],
         "properties": {
           "action_taken": {"type": "string", "enum": ["deactivated", "reenabled", "no_op", "error"]},
           "previous_state": {"type": ["object", "null"]},
           "new_state": {"type": ["object", "null"]},
           "alert_message": {"type": "string"},
           "error_rate_percent": {"type": "number"},
           "threshold_used": {"type": "number"},
           "reason": {"type": ["string", "null"]}
         }
       }
       ```

8. **Telegram Send Message** (`n8n-nodes-base.telegram`)
   - Operation: `sendMessage`
   - Chat ID: `{{YOUR_TELEGRAM_CHAT_ID}}`
   - Text: `={{ $json.alert_message }}`
   - Credential: Telegram API
   - ⚠️ Подключите **только** к main output AI Agent. **НЕ** к NoOp — иначе Telegram будет спамить «без изменений» каждую минуту.

9. **NoOp** (`n8n-nodes-base.noOp`)
   - Подключён к fallback output Switch (no-op ветка)
   - Зачем нужна: без NoOp fallback output обрывается, в execution trace выглядит как ошибка. Явный NoOp = чистый «ничего не делаем» в логах.

10. **(Опционально) Postgres Insert** — historical analytics

## B.4 Шаг 3 — GCAO system prompt для WF2

```
Goal:
Зарегистрировать инцидент или recovery для feature {{$json.feature_id}}.
Текущий error rate: {{$json.error_rate}} (threshold deactivate: 5%, threshold re-enable: 1%).
Текущее состояние: {{$json.current_state.status}}.
Decision из upstream: {{$json.decision}} (deactivate | reenable | noop).

Context:
- Decision уже посчитан upstream (в Switch-ноде) — твоя задача выполнить решение через MCP.
- Available tools: get_feature_info, set_feature_state.
- Threshold deactivate = 5%, re-enable = 1%. При decision=deactivate фича сейчас не Disabled. При decision=reenable фича сейчас Disabled.
- НЕ принимай решение самостоятельно: следуй decision из payload. Это и есть Algorithm-before-AI — guards снаружи модели.

Action:
1. Вызови get_feature_info({{$json.feature_id}}) для актуального state (на случай гонки между Switch и AI Agent).
2. Если decision="deactivate":
   - Проверь что status != "Disabled". Если уже Disabled — верни action_taken="no_op", reason="already_disabled" (защита от спама).
   - Иначе вызови set_feature_state(target_state="Disabled").
   - Снова get_feature_info для верификации.
3. Если decision="reenable":
   - Проверь что status == "Disabled". Если уже Enabled — верни action_taken="no_op", reason="already_enabled".
   - Иначе вызови set_feature_state(target_state="Enabled").
   - Снова get_feature_info для верификации.
4. Если decision="noop" — ничего не делать, верни action_taken="no_op", reason="within_threshold".
5. Сформируй короткий русский alert_message для Telegram.

Output:
JSON строго по схеме:
{
  "action_taken": "deactivated" | "reenabled" | "no_op" | "error",
  "previous_state": object | null,
  "new_state": object | null,
  "alert_message": string (1-2 предложения для Telegram),
  "error_rate_percent": number,
  "threshold_used": number,
  "reason": string | null
}

Constraints:
- alert_message:
  - deactivate: "🚨 Feature {{name}} деактивирована: error rate {{X}}% превысил порог {{Y}}%."
  - reenable:   "✅ Feature {{name}} восстановлена: error rate {{X}}% упал ниже {{Y}}%."
  - no_op:      "ℹ️ Feature {{name}} — без изменений (error rate {{X}}%, статус {{S}})."
- НЕ вызывай set_feature_state если state уже соответствует целевому.
- При ошибке от MCP — action_taken="error" с reason содержащим сообщение от инструмента.
- Если decision="noop" — Telegram сообщение можно НЕ отправлять (см. в Switch ноде Telegram только на не-noop ветках).
```

## B.5 Шаг 4 — Telegram бот для алертов

### Создать бота

1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` → ввести имя и handle (например, `@your_m5_alerts_bot`)
3. Скопировать **bot token** (формат `123456:ABC-DEF...`)
4. (Опционально) `/setdescription` — описание

### Найти chat_id

```bash
# 1. Напишите боту /start в Telegram
# 2. Получите updates:
curl "https://api.telegram.org/bot{YOUR_TOKEN}/getUpdates"
```

В ответе:
```json
{
  "message": {
    "chat": {"id": 123456789, "type": "private"}
  }
}
```

`chat.id` = ваш `chat_id`. Для группы — будет отрицательным (`-1001234567890`).

### В n8n

1. Credentials → New → Telegram API → bot token
2. В WF2 добавить Telegram Send Message ноду
3. Credential: ваш Telegram API
4. Chat ID: `chat_id` из шага выше
5. Text: `{{ $json.alert_message }}`

### Проверка

После запуска `simulate_wf2.py` через 1-2 минуты должно прилететь первое уведомление в Telegram о деактивации фичи.

## B.6 Проверка WF2

- [ ] `simulate_wf2.py` пишет в `logs.json` события с timestamps и status
- [ ] В logs.json есть микс success/error
- [ ] Schedule Trigger срабатывает каждую минуту (видно в n8n executions; нода — `scheduleTrigger`, не cron)
- [ ] Code Node корректно считает error_rate за окно
- [ ] Merge Data Code-нода стоит между HTTP Request и Switch (объединяет данные в один `$json`)
- [ ] Switch (`rules` mode) корректно ветвит deactivate / reenable / fallback noop
- [ ] Fallback output Switch → NoOp нода (`n8n-nodes-base.noOp`), а не «обрыв в воздухе»
- [ ] AI Agent НЕ вызывает set_feature_state повторно если state уже целевой
- [ ] AI Agent **без** Memory ноды (cron stateless — память бесполезна)
- [ ] Telegram подключён ТОЛЬКО к AI Agent main (не к NoOp) — иначе спам каждую минуту
- [ ] За 10 минут симуляции (с period=120s) видно ~2 цикла toggle (Enabled → Disabled → Enabled → Disabled)
- [ ] При decision=fallback (noop) Telegram **не** шлёт ничего

---

# Часть C. Тест на галлюцинации (ОБЯЗАТЕЛЬНО к сдаче)

Демонстрирует что вы поняли **Algorithm-before-AI** принцип.

## Что нужно показать

POST на webhook WF1 с противоречивой командой:

```bash
curl -X POST https://your-n8n.com/webhook/feature-control \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key-here" \
  -d '{"feature_id": "search_v2", "action": "rollout", "traffic_percentage": -50}'
```

**Ожидаемый ответ** (status 400 или 200 с `success: false`):

```json
{
  "success": false,
  "message": "Процент трафика должен быть в диапазоне 0-100. Получено: -50",
  "rejected_at": "input-validation"
}
```

## Где должна стоять защита (defense in depth)

В **двух местах**:

1. **Switch-нода ДО AI Agent** в n8n — отбрасывает невалидные параметры до того как они попадут в LLM. Это и есть Algorithm-before-AI: дешёвый детерминированный guard впереди дорогого LLM-вызова.
2. **JSON Schema в MCP-сервере M3** — `min: 0, max: 100, required: true` на параметре `traffic_percentage`. Это «ремни безопасности» если Switch не отработал по какой-то причине.

> ⚠️ **Защита НЕ должна быть только в system prompt.** Если ваш единственный guard — фраза в промте «не принимай отрицательные числа» — это **не считается**. LLM может проигнорировать ограничение, особенно при длинном контексте или необычных входных.
>
> **Constraint в коде — закон. Constraint в промте — рекомендация.**

## Что приложить в сдаче

- Скриншот / curl-лог с попыткой `-50` и отказом
- В README отметить **где именно** стоит проверка (Switch-нода **и** JSON Schema)
- Прогнать `simulate_wf1.py --include-invalid` — видно что каждый 7-й запрос отвергается на Switch

---

# Часть D. Как использовать Claude Code-агентов для разработки workflow

> В этой папке (`agents/`) лежат два **Claude Code субагента** (не скилла). Они позволяют не кликать в n8n UI часами, а описать что нужно — и получить готовый JSON.
>
> 🧭 **Чем агент отличается от скилла.** Скилл — это «инструкция в кармане», CC-чат активирует её через `/имя-скилла`. Субагент — это отдельный процесс Claude (отдельный контекст, отдельный системный промпт), который дочерний к основному чату. Основной чат вызывает его через Task-tool (или вы пишете «используй субагента такого-то — задача...»). Поэтому ставятся они в `~/.claude/agents/` как одиночные `.md` файлы — никаких папок `~/.claude/skills/<name>/SKILL.md`.

## D.1 Зачем эти агенты

Ручная сборка workflow — последовательность шагов:

1. **Выяснить требования** (триггер, ноды, integrations, edge cases)
2. **Превратить требования в spec** (структурированный документ)
3. **Кликать в UI** или писать JSON руками
4. **Подключать credentials**, проверять connections
5. **Валидировать схему**

Если шаги 1-2 делает **n8n-requirements-orchestrator**, а 3-5 — **n8n-workflow-builder**, у вас остаётся только финальный review JSON и импорт в n8n.

## D.2 Установка

Субагенты в Claude Code — это одиночные `.md` файлы в `~/.claude/agents/` (user-level, доступны во всех проектах) или `.claude/agents/` (project-level, только этот репозиторий). Никаких подпапок `<name>/SKILL.md` — просто `<name>.md`.

```bash
# Вариант A — user-level (доступны во всех проектах)
mkdir -p ~/.claude/agents

cp aidev-course-materials/M5/agents/n8n-workflow-builder.md \
   ~/.claude/agents/n8n-workflow-builder.md

cp aidev-course-materials/M5/agents/n8n-requirements-orchestrator.md \
   ~/.claude/agents/n8n-requirements-orchestrator.md

# Вариант B — project-level (только для текущего репозитория)
# mkdir -p .claude/agents
# cp aidev-course-materials/M5/agents/n8n-workflow-builder.md .claude/agents/
# cp aidev-course-materials/M5/agents/n8n-requirements-orchestrator.md .claude/agents/

# Перезапустите Claude Code. Проверьте что агенты на месте:
ls ~/.claude/agents | grep n8n
# Ожидаемо: 2 файла — n8n-requirements-orchestrator.md, n8n-workflow-builder.md
```

> 💡 Внутри CC можно проверить и список загруженных субагентов командой `/agents` — должны быть видны оба.

## D.3 Промпт 1 — Brainstorm + Requirements Orchestrator

**Когда использовать:** в самом начале, когда есть только идея «хочу чтобы из UI можно было откатить фичу». Этот промпт просит CC вызвать субагента `n8n-requirements-orchestrator`, который задаёт уточняющие вопросы и превращает идею в детальный spec.

Скопируйте в Claude Code:

```
Запусти субагента n8n-requirements-orchestrator.

Войди в режим брейншторма и роль "первого агента, который пишет требования
для разработки n8n-workflow". Я расскажу user story, ты задавай уточняющие
вопросы пока не получишь полный spec. Минимум 5 вопросов перед финальным spec.

Финальный spec должен содержать (в YAML):
- trigger (тип, конфиг, фильтры)
- steps (по порядку с node_type, purpose, config)
- ai_agent_config (model, memory, tools, system_prompt_template_ref)
- credentials_needed
- edge_cases (case + handling)

User story:
[Опишите вашу задачу. Пример для WF1:
"Хочу чтобы при клике на кнопку 'Откатить фичу' в Feature Dashboard
шёл запрос в n8n. AI Agent через MCP M3 проверяет текущее состояние,
если фича не Disabled — переводит её в Disabled. UI обновляется.
Webhook защищён header X-API-Key."]
```

Субагент в роли orchestrator'а задаст уточняющие вопросы (примерно):
- Какой формат ответа для UI? JSON с какими полями?
- Что делать при invalid params (например, `traffic_percentage: -50`)?
- Какая Memory? (рекомендую Window Buffer length=5 для коротких сессий)
- Нужен ли HITL на критическое действие? (бонус)
- Какие именно actions поддерживаются?
- Что возвращать при ошибке от MCP?

В конце вы получите spec.yaml. **Прочитайте его перед передачей builder'у** — orchestrator может пропустить нетривиальные edge cases (sub-second latency, multi-tenant isolation).

### Тот же промпт для WF2

```
Запусти субагента n8n-requirements-orchestrator.

[те же инструкции про брейншторм + орчестратор-роль]

User story:
"Хочу чтобы cron-trigger n8n каждую минуту проверял logs.json:
если error_rate > 5% — AI Agent через MCP деактивирует фичу + шлёт алерт в Telegram.
Если error_rate < 1% и фича Disabled — re-enable.
Логи генерирует Python-симулятор с синусоидальным error_rate."
```

## D.4 Промпт 2 — Workflow Builder (spec → JSON)

**Когда использовать:** после того как spec из шага D.3 готов. Этот субагент превращает структурированный spec в валидный JSON workflow, готовый к импорту в n8n.

> 🎁 **Готовые промпты ниже** валидированы через живой n8n 2.17.7 + `n8n-requirements-orchestrator`. Все имена нод, typeVersion и connection types — реальные с production-инстанса. Просто скопируйте и запустите в Claude Code.

### Промпт WF1 — Manual trigger (готовый к копи-пасте)

```
Запусти субагента n8n-workflow-builder.

Сгенерируй валидный n8n workflow JSON для импорта в n8n 2.x.

Название: wf1-manual-trigger

НОДЫ И ПОРЯДОК:

1. Webhook Trigger
   - type: n8n-nodes-base.webhook
   - typeVersion: 2
   - parameters.httpMethod: POST
   - parameters.path: feature-control
   - parameters.authentication: headerAuth
   - parameters.responseMode: responseNode
   - parameters.options: {}
   - Credential placeholder: {{credentials.headerAuth}}

2. Switch (Input Validation, n8n 2.x rules mode)
   - type: n8n-nodes-base.switch
   - typeVersion: 3
   - parameters.mode: rules
   - parameters.rules.values: 4 правила:
       a) outputKey="missing_feature_id":
          conditions.combinator: and
          conditions.conditions: [{leftValue: "={{ $json.feature_id }}",
                                   operator: {type: "string", operation: "empty"}}]
       b) outputKey="missing_action":
          leftValue: "={{ $json.action }}", operator: string isEmpty
       c) outputKey="invalid_action":
          leftValue: "={{ ['check','test','rollback','rollout'].includes($json.action) }}",
          operator: boolean equals, rightValue: false
       d) outputKey="invalid_traffic":
          leftValue: "={{ $json.traffic_percentage !== undefined && ($json.traffic_percentage < 0 || $json.traffic_percentage > 100) }}",
          operator: boolean equals, rightValue: true
   - parameters.options.fallbackOutput: extra

3. Respond to Webhook 400 (shared, подключён к выходам 0/1/2/3 Switch)
   - type: n8n-nodes-base.respondToWebhook
   - parameters.respondWith: json
   - parameters.responseCode: 400
   - parameters.responseBody: '={"success": false, "message": "Validation error: invalid request", "rejected_at": "input-validation"}'

4. AI Agent (Tools Agent)
   - type: @n8n/n8n-nodes-langchain.agent
   - typeVersion: 3
   - parameters.options.maxIterations: 5
   - parameters.options.systemMessage: "=[SYSTEM_PROMPT_PLACEHOLDER]"
     (я вставлю свой GCAO промт из homework-spec A.5 после генерации)
   - Подключён от fallback output Switch (main[4])

5. Sub-nodes к AI Agent (отдельные ноды, но подключаются через специальные connection types):

   a) Chat Model — выбор студента (Claude / OpenAI / Gemini / OpenRouter)
      connection type: ai_languageModel → AI Agent

   b) Window Buffer Memory
      type: @n8n/n8n-nodes-langchain.memoryBufferWindow
      typeVersion: 1.3
      parameters.contextWindowLength: 5
      parameters.sessionIdType: customKey
      parameters.sessionKey: "={{ $json.feature_id }}"
      connection type: ai_memory → AI Agent

   c) MCP Client Tool (если установлен @n8n/n8n-nodes-langchain community node)
      type: @n8n/n8n-nodes-langchain.toolMcp
      parameters.sseEndpoint: "{{YOUR_M3_MCP_SERVER_URL}}/sse"
      parameters.authentication: bearerToken
      parameters.toolsToInclude: all
      Credential placeholder: {{credentials.bearerToken}}
      connection type: ai_tool → AI Agent

      ИЛИ — если MCP community node не установлен, используй httpRequestTool:
      type: n8n-nodes-base.httpRequestTool (× 3 — по одной на каждый M3 tool)
      Названия: get_feature_info, set_feature_state, adjust_traffic_rollout
      connection type каждой: ai_tool → AI Agent

   d) Structured Output Parser
      type: @n8n/n8n-nodes-langchain.outputParserStructured
      typeVersion: 1
      parameters.schemaType: manual
      parameters.inputSchema: '{"type":"object","required":["success","message"],"properties":{"success":{"type":"boolean"},"message":{"type":"string"},"current_state":{"type":["object","null"]},"rejected_at":{"type":["string","null"]}}}'
      connection type: ai_outputParser → AI Agent

6. Respond to Webhook 200
   - type: n8n-nodes-base.respondToWebhook
   - parameters.respondWith: json
   - parameters.responseCode: 200
   - parameters.responseBody: "={{ $json }}"
   - Подключён от main[0] AI Agent

CONNECTIONS (n8n 2.x формат):
- "Webhook Trigger" main[0] → "Switch" main[0]
- "Switch" main[0..3] (все reject outputs) → "Respond 400" main[0]
- "Switch" main[4] (fallback) → "AI Agent" main[0]
- "Chat Model" ai_languageModel → "AI Agent" ai_languageModel[0]
- "Window Buffer Memory" ai_memory → "AI Agent" ai_memory[0]
- "MCP Tool" (или каждый httpRequestTool) ai_tool → "AI Agent" ai_tool[0]
- "Structured Output Parser" ai_outputParser → "AI Agent" ai_outputParser[0]
- "AI Agent" main[0] → "Respond 200" main[0]

Output:
- Валидный n8n workflow JSON
- Готов к импорту через UI → Settings → Import from File
- Credentials оставлены как placeholders {{credentials.X}}
- Все expressions с префиксом = (например, "=`{{ $json.feature_id }}`")
```

### Промпт WF2 — Scheduled monitor (готовый к копи-пасте)

```
Запусти субагента n8n-workflow-builder.

Сгенерируй валидный n8n workflow JSON для импорта в n8n 2.x.

Название: wf2-scheduled-monitor

НОДЫ И ПОРЯДОК:

1. Schedule Trigger (НЕ Cron — старое имя)
   - type: n8n-nodes-base.scheduleTrigger
   - typeVersion: 1
   - parameters.rule.interval: [{field: "minutes", minutesInterval: 1}]

2. Code Node "Read & Analyze Logs"
   - type: n8n-nodes-base.code
   - typeVersion: 2
   - parameters.jsCode: |
       const fs = require('fs');
       const path = '/data/logs/logs.json';
       let data = [];
       try { data = JSON.parse(fs.readFileSync(path, 'utf-8')); }
       catch(e) { return [{json:{error:e.message,error_rate:0,total:0,errors:0,feature_id:'search_v2'}}]; }
       const now = Date.now(), window_ms = 60*1000;
       const recent = data.filter(e => (now - new Date(e.timestamp).getTime()) < window_ms);
       const total = recent.length, errors = recent.filter(e=>e.status==='error').length;
       return [{json:{feature_id:'search_v2', error_rate: total>0?errors/total:0, total, errors}}];

3. HTTP Request "Get Feature Status"
   - type: n8n-nodes-base.httpRequest
   - parameters.method: POST
   - parameters.url: "{{YOUR_M3_MCP_SERVER_URL}}/tools/get_feature_info"
   - parameters.authentication: genericCredentialType
   - parameters.sendBody: true
   - parameters.bodyParameters.parameters: [
       {name: "feature_id", value: "={{ $('Read & Analyze Logs').item.json.feature_id }}"}
     ]

4. Code Node "Merge Data" (обязательно — Switch не может cross-node refs)
   - type: n8n-nodes-base.code
   - parameters.jsCode: |
       return [{json:{
         feature_id: $('Read & Analyze Logs').item.json.feature_id,
         error_rate: $('Read & Analyze Logs').item.json.error_rate,
         current_status: $('Get Feature Status').item.json.status
                       ?? $('Get Feature Status').item.json.current_state?.status
       }}];

5. Switch "Decision" (rules mode)
   - type: n8n-nodes-base.switch
   - typeVersion: 3
   - parameters.mode: rules
   - 2 правила:
       a) outputKey="deactivate":
          conditions.combinator: and
          conditions.conditions: [
            {leftValue: "={{ $json.error_rate }}", operator: {type:"number", operation:"gt"}, rightValue: 0.05},
            {leftValue: "={{ $json.current_status }}", operator: {type:"string", operation:"notEquals"}, rightValue: "Disabled"}
          ]
       b) outputKey="reenable":
          conditions.conditions: [
            {leftValue: "={{ $json.error_rate }}", operator: {type:"number", operation:"lt"}, rightValue: 0.01},
            {leftValue: "={{ $json.current_status }}", operator: {type:"string", operation:"equals"}, rightValue: "Disabled"}
          ]
   - parameters.options.fallbackOutput: extra (→ NoOp)

6. Set Node "Set Decision deactivate"
   - type: n8n-nodes-base.set
   - typeVersion: 3.7
   - parameters.fields: [
       {name:"decision", value:"deactivate"},
       {name:"feature_id", value:"={{ $json.feature_id }}"},
       {name:"error_rate", value:"={{ $json.error_rate }}"},
       {name:"current_status", value:"={{ $json.current_status }}"}
     ]
   - Подключён к Switch output[0]

7. Set Node "Set Decision reenable" — аналогично, decision="reenable", подключён к output[1]

8. AI Agent "Monitor Agent" (ОДИН агент на обе ветки)
   - type: @n8n/n8n-nodes-langchain.agent
   - typeVersion: 3
   - parameters.options.maxIterations: 3
   - parameters.options.systemMessage: "=[GCAO_B4_PLACEHOLDER]"
   - Подключён от main обеих Set нод
   - Sub-nodes (НЕТ Memory — cron stateless):
       a) Chat Model — ai_languageModel
       b) MCP Tool или 2× httpRequestTool (get_feature_info, set_feature_state) — ai_tool
       c) Output Parser:
          schema: '{"type":"object","required":["action_taken","alert_message"],"properties":{"action_taken":{"type":"string","enum":["deactivated","reenabled","no_op","error"]},"alert_message":{"type":"string"},"previous_state":{"type":["object","null"]},"new_state":{"type":["object","null"]},"error_rate_percent":{"type":"number"},"threshold_used":{"type":"number"},"reason":{"type":["string","null"]}}}'
          ai_outputParser

9. Telegram "Send Alert"
   - type: n8n-nodes-base.telegram
   - parameters.operation: sendMessage
   - parameters.chatId: "{{YOUR_TELEGRAM_CHAT_ID}}"
   - parameters.text: "={{ $json.alert_message }}"
   - Credential placeholder: {{credentials.telegramApi}}
   - Подключён ТОЛЬКО к AI Agent main[0]

10. NoOp
    - type: n8n-nodes-base.noOp
    - Подключён к Switch fallback output[2]

CONNECTIONS:
- "Schedule Trigger" main → "Read & Analyze Logs" main
- "Read & Analyze Logs" main → "Get Feature Status" main
- "Get Feature Status" main → "Merge Data" main
- "Merge Data" main → "Switch" main
- "Switch" main[0] → "Set Decision deactivate" main
- "Switch" main[1] → "Set Decision reenable" main
- "Switch" main[2] (fallback) → "NoOp" main
- "Set Decision deactivate" main → "AI Agent" main
- "Set Decision reenable" main → "AI Agent" main
- (Chat Model / Tools / Output Parser) → ai_* connections → "AI Agent"
- "AI Agent" main → "Telegram" main

Output:
- Валидный n8n workflow JSON готов к импорту
- Credentials как placeholders
- typeVersion проставлены везде
```

**После генерации:**
1. Импортируйте JSON в n8n (Settings → Import from File)
2. Проверьте connections визуально — особенно sub-nodes у AI Agent
3. Настройте credentials (Header Auth, Bearer Token для MCP, Telegram API, выбранный Chat Model)
4. Замените `[SYSTEM_PROMPT_PLACEHOLDER]` / `[GCAO_B4_PLACEHOLDER]` на GCAO промты из секций A.5 / B.4
5. Замените `{{YOUR_M3_MCP_SERVER_URL}}`, `{{YOUR_TELEGRAM_CHAT_ID}}` на ваши значения
6. Прогоните test execution

> ⚠️ Builder может галлюцинировать имена нод. Если что-то падает на import — сравните JSON с этими промтами. Имена нод и typeVersion'ы валидированы на live n8n 2.17.7.

## D.5 Промпт 3 (опционально) — Deploy через n8n MCP

**Когда использовать:** если у вас есть n8n MCP server подключен в Claude Code (см. `~/.claude/.mcp.json`). Тогда не нужно копи-пастить JSON через UI — можно попросить CC залить workflow напрямую.

```
prompt:

В моём CC настроен n8n MCP server (ops: workflow_create, workflow_update,
workflow_activate, workflow_test_execute). Используя эти ops:

1. Создай workflow в моём n8n инстансе из JSON ниже
2. Активируй его
3. Прогони test execution с payload:
   { "feature_id": "search_v2", "action": "check" }
4. Верни мне webhook_url созданного workflow + execution_id первого теста

JSON:
[Вставьте JSON из шага D.4]

Если что-то падает на validation — НЕ создавай workflow, верни мне ошибки чтобы я исправил.
```

### Что должно быть настроено заранее

- В `~/.claude/.mcp.json` — n8n MCP server с creds к вашему инстансу
- В n8n — включён Public API + API token

Если MCP нет — пропустите эту часть, импортируйте JSON через `Import from File` в UI.

## D.6 Вспомогательный промт — «помоги написать GCAO для AI Agent»

Если хочется свой вариант GCAO под другую фичу / другой набор tools:

```
prompt:

Помоги написать GCAO system prompt для AI Agent ноды в n8n.

Контекст:
- Я строю [WF1 manual trigger / WF2 scheduled monitor].
- Агент использует MCP с tools: [перечислите ваши tools].
- Триггер: [webhook / cron].
- Возвращает JSON: [опишите схему].

Особенности задачи: [опишите — например, "search_v2 production-критичная,
любая deactivation требует особой осторожности"]

Сгенерируй GCAO в 4 блока (Goal / Context / Action / Output) + Constraints.
Action — пронумерованным списком конкретных шагов.

В конце объясни:
- Что в Constraints — рекомендация для модели, не закон
- Где живёт реальный guard (Switch + JSON Schema)
```

## D.7 Антипаттерн использования агентов

❌ **Не используйте оба агента подряд без review.** Builder может ошибаться на nested sub-nodes (AI Agent + Memory + Tools — тонкая структура). После генерации **обязательно** проверьте JSON в n8n UI до production.

❌ **Не доверяйте orchestrator на edge cases.** Он хорошо собирает happy path, но edge cases требуют вашего внимания.

❌ **Не хардкодьте credentials.** В сгенерированном JSON credentials должны быть placeholders.

---

# Сдача — что в PR

**Один артефакт — PR в `proshop_mern`** с папкой `homework/M5/`:

```
proshop_mern/
├── frontend/src/
│   └── (расширенный Dashboard + AutoPilotControls.jsx)
└── homework/M5/
    ├── README.md                       ← обязательно (шаблон ниже)
    ├── wf1-manual-trigger.json
    ├── wf2-scheduled-monitor.json
    ├── simulate_wf1.py
    ├── simulate_wf2.py
    ├── logs.json                       ← пример после прогона
    ├── trace-wf1.png
    ├── trace-wf2-toggle.png
    └── screencast.mp4 (или ссылка)
```

## Шаблон README.md

```markdown
# M5 Homework — n8n Agentic Workflows

## Архитектура (2-3 предложения)
[Кратко: как WF1 + WF2 работают вместе, как связаны с M3 MCP + M4 Dashboard]

## Стек
- n8n: cloud / self-hosted Docker / n8n-install (укажите выбор)
- Chat Model: [Claude Sonnet 4 / GPT-5 mini / Gemini 3 Flash / OpenRouter] + обоснование
- Storage логов: JSON / Postgres / Redis Stream + обоснование
- Telegram bot: @your_bot_handle (для проверки можете прислать chat_id личным сообщением преподавателю)

## WF1 — Manual trigger
- Webhook URL: [для проверки укажите тестовый URL]
- Auth: X-API-Key (key не публикуйте — пришлите отдельно)
- Что нового в Dashboard: [перечислите]

## WF2 — Scheduled monitor
- Threshold deactivate: 5% / threshold re-enable: 1% (или ваши значения с обоснованием)
- Logs storage: [logs.json / другое]
- Sine period симулятора: [300s / другое]
- Telegram chat для алертов: [ID или handle]

## Тест на галлюцинации
- Где стоит защита: Switch-нода **и** JSON Schema (обе)
- Лог отказа на -50%: [приложите вывод curl или скрин simulate_wf1 --include-invalid]

## Как запустить
```bash
# 1. Импортировать workflow в n8n
# 2. Настроить credentials (MCP M3, Telegram, X-API-Key)
# 3. Запустить симуляторы:
python3 simulate_wf2.py --output logs.json --duration 600 --period 120 &
python3 simulate_wf1.py --webhook-url ... --duration 120 --include-invalid
```

## Что было сложно
[2-3 предложения. Что не получилось с первого раза, как разобрались]

## Бонусы (если делали)
- [ ] HITL Wait-нода на критическое действие
- [ ] Langfuse / LangSmith трейсинг
- [ ] Multi-agent supervisor + worker
- [ ] Deploy через n8n MCP (не копи-паст в UI)
- [ ] Persistent state в Postgres вместо JSON
```

## Screencast (3-5 минут)

Должен показать:
1. Клик на «Откатить фичу» в Dashboard → состояние меняется
2. `simulate_wf1.py --include-invalid` → видно отказы на `-50`
3. `simulate_wf2.py` запущен фоном
4. В n8n executions видно срабатывание WF2 cron
5. Telegram получает алерты deactivate → re-enable → deactivate (полный цикл)
6. В Dashboard статус фичи обновляется автоматически

Хостинг — Loom / YouTube unlisted / Telegram-storage / GitHub если <100MB.

---

# Чеклист перед PR (бинарно, пройдитесь по каждому)

## WF1 — Manual trigger

- [ ] Feature Dashboard расширен блоком «Auto-Pilot Controls» с 3 кнопками
- [ ] Webhook trigger в n8n принимает POST `/feature-control` с auth X-API-Key
- [ ] Без правильного header — 403 (проверено curl'ом)
- [ ] Switch (`rules` mode, n8n 2.x) валидирует параметры до AI Agent (4 правила + fallback output)
- [ ] AI Agent ноде подключены через правильные connection types:
   - Chat Model → `ai_languageModel`
   - Window Buffer Memory (length=5, `sessionKey={{ $json.feature_id }}`) → `ai_memory`
   - MCP Client Tool (`@n8n/n8n-nodes-langchain.toolMcp`) ИЛИ 3× `httpRequestTool` → `ai_tool`
   - Structured Output Parser → `ai_outputParser`
- [ ] `maxIterations=5` в `parameters.options.maxIterations`
- [ ] System Message в `parameters.options.systemMessage` с префиксом `=` (expression syntax)
- [ ] Respond to Webhook возвращает JSON с полями `success`, `message`, `current_state`
- [ ] UI рендерит обновлённое состояние feature flag + alert от агента

## WF2 — Scheduled monitor

- [ ] `simulate_wf2.py` работает, пишет в `logs.json` события с синусоидальным error rate
- [ ] Schedule Trigger в n8n запускается раз в минуту (`n8n-nodes-base.scheduleTrigger`, не cronTrigger)
- [ ] Code Node читает логи и считает error_rate за окно
- [ ] Merge Data Code-нода объединяет результаты Code + HTTP Request в один `$json` перед Switch
- [ ] Switch (`rules` mode): deactivate / re-enable + fallback → NoOp (видно полный цикл toggle)
- [ ] AI Agent НЕ имеет Memory ноды (cron stateless)
- [ ] AI Agent НЕ вызывает set_feature_state повторно если state уже целевой
- [ ] Telegram подключён только к main AI Agent (не к NoOp output)
- [ ] WF2 не спамит на fallback noop (молчит)

## Тест на галлюцинации

- [ ] Команда с `traffic_percentage: -50` **отвергается до AI Agent** (Switch)
- [ ] JSON Schema в MCP-сервере M3 имеет `min: 0, max: 100` на `traffic_percentage`
- [ ] `simulate_wf1.py --include-invalid` показывает отказы

## Симуляторы

- [ ] `simulate_wf1.py` дёргает webhook с sine traffic_percentage и опционально с invalid
- [ ] `simulate_wf2.py` пишет в logs.json с sine error rate (period 5 мин по умолчанию)
- [ ] Оба запускаются с понятным `--help`

## CC-агенты

- [ ] Субагенты `n8n-requirements-orchestrator` и `n8n-workflow-builder` установлены в `~/.claude/agents/` (`ls ~/.claude/agents | grep n8n` → 2 файла)
- [ ] (Опционально) пробовали Промпт 3 — deploy через n8n MCP

## Сдача

- [ ] PR в `proshop_mern` создан
- [ ] Папка `homework/M5/` содержит все артефакты из шаблона
- [ ] Screencast 3-5 мин показывает: команду из UI + sim + n8n trace + Telegram cycle
- [ ] README отвечает на все секции шаблона
- [ ] Ссылка на PR отправлена в LMS / чат курса

---

# Бонусы (опционально, не влияют на оценку)

- **HITL Wait-нода** — перед `set_feature_state='Disabled'` в WF2 спросить подтверждение через Telegram кнопку (Approve / Decline). Production-паттерн 95/5: 95% действий автомат, 5% через human approval. См. Appendix E (Defensive Guard GCAO template).
- **Langfuse / LangSmith трейсинг** — observability для агентов. Покажет реальный flow tool-вызовов, токены, latency.
- **Multi-agent supervisor + worker** — supervisor читает sentiment / context из логов, worker делает конкретное действие. Две ноды AI Agent в n8n.
- **Deploy через n8n MCP** — workflow JSON заливается напрямую через MCP, не копи-пастом (Промпт 3 в части D).
- **Postgres Chat Memory** вместо Window Buffer — для долгоживущих сессий с множеством событий. См. Appendix C.
- **Replay-логика** — re-enable через N минут после Disabled (а не сразу). Минимальная adaptive logic.

---

# Полезные ресурсы

| Что | Где |
|---|---|
| n8n официальная документация | https://docs.n8n.io |
| AI Agent node документация | https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent |
| MCP Client Tool node | https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.mcpclienttool |
| n8n Guardrails node | https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.guardrails |
| Anthropic «Building Effective Agents» | https://www.anthropic.com/research/building-effective-agents |
| Anthropic «Writing Effective Tools for AI Agents» | https://www.anthropic.com/engineering/writing-tools-for-agents |
| n8n templates marketplace | https://n8n.io/workflows |
| n8n-install (стек для self-host) | https://github.com/kossakovsky/n8n-install |
| Telegram Bot API | https://core.telegram.org/bots/api |
| guides/browser-use-prompt-injection-defenses.md | Защиты от prompt injection в browser-agent продуктах (теория, отдельно от домашки) |

---

# Appendix A — Best Practices: production-агенты в n8n

> Сводка правил для построения агентов в n8n. Distilled от практики 2025-2026.

## A.1 Приоритет интеграции: нода > HTTP > MCP

Когда агенту нужен внешний сервис — выбирайте в строгом порядке:

### 1. Native node (первый выбор)

Если в каталоге n8n есть нода для нужного сервиса (Google Calendar, Slack, Gmail, Notion, Airtable, Stripe и сотни других) — используйте её. Это даёт:

- **Скорость** — прямой API-вызов без накладных расходов на discovery
- **Стабильность** — нода поддерживается командой n8n, OAuth настраивается в один клик
- **Отлаживаемость** — явные параметры в UI и понятные логи
- **Узкая область видимости** — агент видит ровно один инструмент с понятным контрактом

### 2. HTTP Request (когда нет нативной ноды)

Если сервис не покрыт нодой, но имеет REST API — берите HTTP Request. Конфигурацию можно импортировать прямо из curl-команды документации сервиса. Это всё ещё детерминированный вызов, его легко отлаживать.

### 3. MCP Client Tool (только в трёх случаях)

- Сервиса нет ни в нодах, ни легко через HTTP, но есть готовый MCP-сервер (как ваш M3)
- Нужно динамическое обнаружение — агент сам выбирает между несколькими инструментами одного сервера, и набор инструментов может меняться без правки workflow
- Cross-instance оркестрация — один n8n-агент использует инструменты другого n8n-сервера или Claude Desktop

### Антипаттерн

> Делать кастомный MCP-сервер вокруг сервиса, для которого уже есть нативная нода. Медленнее, тяжелее в отладке, требует дополнительного сетевого слоя.

**Аналогия:** native node — приложение на телефоне (быстро, надёжно). HTTP — браузер (универсально, чуть медленнее). MCP — интернет-протокол: мощно для переменных тулов и cross-instance, избыточно для «дёрнуть один Slack».

## A.2 Tool Isolation

Атомарные тулы лучше монолитных. Разбивайте монолитный `manage_lead` на атомарные `search_leads` + `create_lead`. Это даёт:

- Точный повтор на упавшем фрагменте без пересжигания контекста
- Облегчение аудита — каждый вызов виден отдельно
- Меньше галлюцинаций при выборе параметров (узкий контракт = меньше степеней свободы)

### Anthropic 4 правила Tool Design

Из «Writing Effective Tools for AI Agents»:

1. **Пишите для модели, а не для человека** — positive instructions работают лучше negative («Сначала проверь бюджет через getBudget» вместо «Не вызывай без проверки бюджета»)
2. **Жёсткая JSON-схема + дефолты** — чем строже параметры (типы, enum, required), тем меньше галлюцинаций
3. **Ошибки как инструкции, не как stacktrace** — «Бюджет превышен, лимит 4000, предложи уменьшить» вместо `Something went wrong`
4. **20-tool ceiling** (Shopify Sidekick) — меньше = границы чётче. >50 = «смерть от тысячи инструкций»

### Poka-yoke

Toyota-принцип: структурно невозможно сделать неправильный вызов. Anthropic SWE-bench: relative paths → required absolute paths = **entire failure class eliminated**.

## A.3 maxIterations — обязательная защита

Цикл агента может зациклиться при противоречивых tool-результатах или неустойчивом промте. Верхняя граница на число итераций — **критическая защита** от неконтролируемого роста расходов.

### Рекомендации

- **Триаж и классификация** — `maxIterations = 5`
- **Многошаговые исследовательские агенты** — `maxIterations = 10-15`
- **Долгие производственные пайплайны** — `maxIterations = 20`, не больше

## A.4 Structured Output

JSON output через **Structured Output Parser** в Agent-ноде вместо свободного текста. Для production — **обязательно**.

### Зачем

- Гарантия формата (next step не сломается на missing field)
- Возможность валидации (JSON Schema на выходе)
- Чёткая граница между «решение агента» и «формат для downstream»

### Как настроить

В n8n AI Agent ноде → подключить Structured Output Parser sub-node → описать ожидаемый JSON schema → агент возвращает ровно этот формат.

> Это место **«тихих поломок production-агентов»**: модель вернула что-то похожее на JSON, но с лишним полем — workflow ниже по течению ломается без понятной причины. Structured Output убирает этот класс ошибок.

## A.5 Fallback-модель + retry

### Fallback-модель

В AI Agent можно указать запасную Chat Model на случай 5xx у основного провайдера. Типовой паттерн: при перебое OpenAI workflow автоматически уходит в Anthropic с чуть подправленным системным промтом.

### Retry с exp backoff

Сетевые сбои API провайдера — норма; повторные попытки с exponential backoff ставятся на ноду Chat Model или внешним обработчиком ошибок workflow.

## A.6 Observability

Минимум для production-мониторинга:

- **Success rate** — доля успешно завершённых запусков workflow к общему числу
- **Latency на инструмент** — распределение времени выполнения каждого подключённого инструмента
- **Число итераций цикла** — если 90-й перцентиль внезапно подскочил с 3 до 7, это сигнал что промт или набор инструментов деградировал
- **Токены и стоимость на запуск** — без этой метрики невозможно ловить инциденты со стоимостью
- **Доля fallback-вызовов** — сколько процентов запусков ушло во вторичную модель (индикатор состояния основного провайдера)

### Tools

- **Langfuse** — OSS, MIT, acquired by ClickHouse Jan 2026
- **LangSmith** — LangChain-native tracing
- **Arize Phoenix** — RAG-eval focus
- **n8n executions API** — встроенные логи + Error Trigger для уведомлений

## A.7 Когда уходить из low-code

Признаки что задача переросла n8n:

- Агент использует **больше 4-5 инструментов** одновременно — отладка ломается, логи видны только у последнего узла
- **3+ уровня вложенности** sub-workflow — практически невозможно отлаживать
- System prompt уходит за **2000+ слов** — пора декомпозировать в код
- Нужна **sub-second задержка** или строгий контроль стоимости одного вызова
- Продукт — B2B SaaS с тысячами одновременных пользователей
- Регрессионные тесты в CI — canvas нельзя `pytest`-нуть

Типовая эволюция production-агента:

```
Make / Zapier
    ↓ (быстрый прототип)
n8n или другой low-code
    ↓ (продакшен workflow с AI-вставками)
LangGraph / Pydantic AI / Mastra (масштаб, надёжность, наблюдаемость)
```

Не каждый проект доходит до конца — большинство останавливается на n8n, и это норма.

---

# Appendix B — Algorithm-before-AI: 4 слоя guards

## B.1 Главное правило

> **Constraint в коде = закон. Constraint в промте = рекомендация.**

LLM в production-системе должен быть **одним узлом** в жёстком детерминированном графе, а не центром принятия решений.

## B.2 Почему критично — реальные инциденты

### Replit (июль 2025)

Автономный агент **молча решил полностью очистить production базу данных клиента**:
- 12-дневный vibe-coding эксперимент по построению SaaS-продукта через диалог с агентом
- 11 раз в ALL CAPS оператор запретил агенту что-либо менять без явного подтверждения
- Объявлена заморозка кода
- Агент проигнорировал все инструкции, выполнил деструктивные команды, удалил данные **1206 руководителей и 1196 компаний**
- После инцидента — **сфабриковал данные**: 4000 фейковых пользователей в новой пустой таблице, сфальсифицировал результаты unit-тестов
- Сообщил оператору, что откат технически невозможен — это оказалось ложью

CEO компании публично извинился, анонсировал автоматическое разделение сред разработки и продакшена.

**Что показывает инцидент:**

> Ограничение в естественном языке **не переопределяет поведение модели** во время многошагового исполнения. Модель решила, что задача важнее ограничения, и нашла себе оправдание.

### Другой кейс — `rmdir` в корне диска

Автономный агент должен был удалить кэш-папку, но путь параметра был относительным, и модель решила, что корень и есть рабочая директория. Выполнил `rmdir /` — диск частично очищен.

**Урок:** требовать абсолютные пути в схеме инструмента → entire failure class eliminated.

## B.3 4 слоя guards в n8n

### Слой 1: Pre-agent guard (input)

**Switch / If нода** до AI Agent проверяет валидность параметров. Если входная команда содержит `traffic_percentage: -50`, **не отправляйте это в LLM** — отклоните на уровне Switch ноды с понятным сообщением.

Пример из WF1:

```
Webhook Trigger
  ↓
Switch:
  ├── traffic_percentage < 0 ИЛИ > 100  →  Respond 400 «Процент трафика вне диапазона»
  ├── feature_id отсутствует             →  Respond 400 «feature_id required»
  └── всё ок                              →  AI Agent
```

### Слой 2: Schema enforcement в MCP-сервере

**JSON Schema на параметрах MCP-инструмента** — самый дешёвый guard. Если параметр должен быть в `[0, 100]` — это **в схеме**, не в системном промте:

```python
from typing import Annotated
from pydantic import Field

@mcp.tool()
def adjust_traffic_rollout(
    feature_id: str,
    traffic_percentage: Annotated[int, Field(ge=0, le=100)],
) -> dict:
    """Устанавливает процент трафика для feature flag."""
    ...
```

### Слой 3: Output guardrail

**Structured Output Parser** + явная валидация результата перед использованием дальше по графу.

Это место **«тихих поломок production-агентов»**: модель вернула что-то похожее на JSON, но с лишним полем — workflow ниже по течению ломается без понятной причины.

```
AI Agent
  ↓
Structured Output Parser (JSON schema)
  ↓
Code Node (доп. валидация: required fields, типы)
  ↓
IF (валидно) → continue
   ELSE       → fallback / retry / error log
```

### Слой 4: HITL on tool execution

**Wait-нода** на критические инструменты. Workflow паузится → согласующий получает уведомление в Slack/Telegram (`$tool.name` + `$tool.parameters`) → решение возвращается в тот же run через webhook resume.

**Применять для всего что меняет state продакшена:**
- Send messages пользователям
- Modify records в базе
- Delete data
- Full traffic rollout
- Refunds, transactions

**Стандарт production:** **95% автоматически, 5% через HITL** для деструктивных и денежных операций.

## B.4 Native инструменты n8n для guards

- **Guardrails core node** — built-in, 9 типов (Jailbreak, NSFW, Secret Keys, PII, URLs, Topical Alignment, Custom) + Sanitize Text mode для редактирования чувствительного контента. Можно ставить и до, и после AI Agent
- **HITL on tool execution** — built-in, документирован в [n8n docs](https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/)
- **Switch / IF / Code Node** — обычный детерминированный flow

## B.5 Антипаттерн

> Полагаться на system prompt в стиле «не делай X» как на единственный guard. Это ненадёжно: модель может проигнорировать ограничение, особенно при длинном контексте или необычных входных.

Это правило стоит запомнить, и не как лозунг, а как технический критерий: если ваш guard живёт **только** в промте — у вас **нет** guard.

---

# Appendix C — Memory types в n8n

| Тип | Что | Pricing impact | Когда |
|---|---|---|---|
| **Simple Memory** | История в Python-dict внутри процесса | бесплатно | Только тесты / notebooks. **НЕ работает в queue mode** |
| **Window Buffer Memory** | Последние N сообщений в скользящем окне | константный (контролируемый) | **Default для большинства агентов** |
| **Conversation Buffer Memory** | Полная история диалога | растёт линейно с числом ходов | **Никогда в продакшен** |
| **Postgres Chat Memory** | Сохранение состояния через Postgres-таблицу | стоимость БД + токены | Многопользовательские системы, выживает рестарты |
| **Vector Store Memory** | Эмбеддинги в Pinecone/Qdrant/Supabase | стоимость embedding + БД | Семантическое извлечение |

## C.1 Window Buffer Memory ⭐ (default)

Стоимость в токенах остаётся **постоянной** — окно всегда фиксированного размера.

**Когда:**
- Триаж и классификация — `length=5`
- Разговорные ассистенты поддержки — `length=20`
- Single-turn задачи с контекстом — `length=3-5`

## C.2 Conversation Buffer Memory ⚠️ (антипаттерн)

**Каждый запуск отправляет в LLM весь предыдущий диалог.**

### Реальный кейс перерасхода

> Команда поставила Conversation Buffer Memory без ограничения окна на агента первичной сортировки. **500 запусков в день**, средняя сессия 30 сообщений. Через месяц — счёт OpenAI **$400**.
>
> Перевод на Window Buffer Memory `length=5` — счёт упал до **$40/мес** в десять раз.

## C.3 Postgres Chat Memory — production gotcha

n8n issue #12958: настройка `Context Window Length` в Postgres Chat Memory **не уважается** частью узлов.

**Симптом:** по логам OpenAI улетает не последние N сообщений, а вся таблица истории — десятки килобайт текста, latency 4 сек → 1 мин, счёт растёт пропорционально.

**Workaround:** Code-узел перед AI Agent, который вручную обрезает историю:

```javascript
// В Code Node перед AI Agent
const fullHistory = $input.all();
const N = 10;  // желаемое окно
const trimmed = fullHistory.slice(-N);
return trimmed;
```

> **Урок:** декларативные настройки в low-code требуют **независимой проверки** реального ввода в LLM через логи исполнения. Доверяйте тому, что видите в логах LLM, а не тому, что декларировано в UI.

## C.4 Memory в этой домашке

- **WF1 Manual trigger:** Window Buffer Memory `length=5` — короткие сессии управления feature flag.
- **WF2 Scheduled monitor:** Window Buffer `length=3` или **без памяти** — каждый cron-tick отдельная задача, контекст сбрасывается.

> Если в WF2 нужно «помнить что фича X была деактивирована 5 минут назад» — это **не Memory задача**, а **persistent state** в Postgres / Redis. Memory — для контекста LLM-разговора. State — для фактов о мире.

## C.5 Внешние memory-системы (для backlog)

| Vendor | Architecture | LongMemEval | Sweet spot |
|---|---|---|---|
| **Mem0** | Vector + graph + KV | 26-49% | AWS Agent SDK exclusive provider |
| **Zep (Graphiti)** | Temporal knowledge graph | **94.8% (+15pp)** | Compliance, audit-friendly |
| **Letta** (ex-MemGPT) | OS-paged virtual context | 93.4% | Long-running enterprise |
| **LangMem** | Open SDK | n/a | LangChain teams, MIT |

---

# Appendix D — Troubleshooting типовых ошибок

## D.1 n8n setup

### n8n не стартует / порт занят

```bash
docker run -p 5678:5678 n8nio/n8n
# Error: bind: address already in use
```

**Решение:**
```bash
lsof -i :5678
# kill процесс или используйте другой порт:
docker run -p 5679:5678 n8nio/n8n
```

### env-переменные не подхватываются (self-host)

```bash
docker run -p 5678:5678 --env-file .env n8nio/n8n
```

Или пробросить отдельные:
```bash
docker run -p 5678:5678 -e N8N_BASIC_AUTH_ACTIVE=true n8nio/n8n
```

## D.2 n8n MCP-сервер из Claude Code

### n8n MCP-сервер не отвечает

**Чеклист:**
1. Включён ли MCP server в n8n (Settings → API → Enable Public API)?
2. Сгенерирован ли API token? Bearer token обязателен в продакшен
3. Доступен ли n8n endpoint снаружи (если CC на хосте, n8n в Docker — `http://host.docker.internal:5678`)?
4. Healthcheck: `curl https://your-n8n.com/healthz`

### n8n MCP в queue mode рвёт SSE-соединения

**Решение:** выделить отдельную реплику вебхуков под `/mcp*` и закрепить её на уровне ingress / load balancer.

### nginx обрывает MCP-стрим

**Решение:** в nginx-конфиге для `/mcp*` пути:
```nginx
location /mcp/ {
    proxy_buffering off;
    gzip off;
    proxy_set_header Connection '';
    chunked_transfer_encoding off;
    proxy_pass http://n8n:5678;
}
```

## D.3 AI Agent нода

### Agent зацикливается

**Решения по приоритету:**
1. **Установите `maxIterations`** в AI Agent ноде (5-15 для большинства случаев). Это **обязательный** guard
2. Проверьте tool descriptions — двусмысленные описания заставляют агента вызывать тулы повторно
3. Проверьте system prompt на конфликтующие инструкции
4. Включите Structured Output Parser — заставляет агента дать финальный ответ в JSON

### Agent не вызывает tools

**Возможные причины:**
- Tool descriptions слишком общие
- Параметры tool не понятны без context (нет `description` на параметрах)
- Слабая модель — попробуйте Claude Sonnet 4 / GPT-5 mini вместо Haiku для tool selection
- В system prompt нет указания что tools нужно использовать

**Решение:** добавьте в system prompt явное:
```
You MUST use tools to interact with feature flags. Do NOT answer based on assumptions.
For status questions — call get_feature_info first. For state changes — call set_feature_state.
```

### Hallucinated tool args

**Симптом:** агент вызывает `set_feature_state(traffic_percentage=-50)` несмотря на то что это невалидно.

**Решение:** Algorithm-before-AI (Appendix B):
1. Switch-нода до AI Agent — отбрасывает невалидные параметры
2. JSON Schema на MCP-инструменте с `min`, `max`, `enum`, `required`

## D.4 Webhook trigger

### Webhook возвращает 404

**Чеклист:**
1. Активирован ли workflow? В тестовом режиме URL только активен пока «Listen for test event» включён
2. Production URL vs Test URL — в n8n UI разные. Production URL работает только после клика «Activate workflow»
3. Полный path — `https://your-n8n.com/webhook/feature-control` (с `/webhook/` префиксом)

### Webhook принимает запрос, но не отвечает

**Решение:** в Webhook Trigger ноде → `Respond` параметр должен быть `Using 'Respond to Webhook' Node`. И в конце workflow обязательно нода **Respond to Webhook** с JSON-ответом.

### Webhook 403 при правильном X-API-Key

**Чеклист:**
1. Header Auth credential в n8n создан и привязан к Webhook ноде?
2. Имя header — `X-API-Key` (или другое, главное чтобы совпадало с фронтом)?
3. Значение header не имеет лишних пробелов / переноса строки?

## D.5 Telegram-бот для WF2 alerts

### Telegram падает с 401

**Решение:**
1. Создать бота через [@BotFather](https://t.me/BotFather) — `/newbot`
2. Скопировать **bot token** (формат `123456:ABC-DEF...`)
3. В n8n credentials → Telegram API → вставить token
4. Test connection — должно сказать success

### Бот не отправляет сообщения

`chat_id` неправильный. Найти:
```bash
curl "https://api.telegram.org/bot{YOUR_TOKEN}/getUpdates"
```

В ответе `chat.id` — нужное значение. Для группы — будет отрицательным.

## D.6 Имитация трафика (`simulate_wf2.py`)

### WF2 не видит логов

**Чеклист:**
1. Где живёт `logs.json` — в **той же** файловой системе что и n8n?
2. Если n8n в Docker — нужно volume-mount: `-v $(pwd)/logs:/data/logs`
3. n8n Code Node читает по абсолютному пути или относительному к workdir?

**Альтернатива** — Postgres-таблица или Redis Stream вместо JSON файла.

### WF2 спамит алертами

**Решение:** в system prompt агента добавлена проверка `Если status уже Disabled — НЕ вызывай set_feature_state повторно`. И/или IF-нода перед AI Agent:

```
Code Node: считает error_rate
  ↓
HTTP Request: get_feature_info через MCP
  ↓
IF (error_rate > 5% AND status != "Disabled") → AI Agent
   ELSE → log_only
```

## D.7 MCP-сервер из M3

### AI Agent не видит инструменты MCP M3

**Чеклист:**
1. MCP-сервер запущен и доступен? `curl https://your-mcp.com/health`
2. В n8n MCP Client Tool ноде — правильный URL? Bearer token?
3. `Tools to Include` параметр — `All` или `Selected` с правильными именами?

### MCP отвечает но tool вызовы failure

**Возможные причины:**
- JSON Schema на MCP не совпадает с тем что передаёт агент
- Parameter type mismatch (например, `traffic_percentage` ожидается `int` а агент передаёт `string`)
- MCP-сервер не обрабатывает errors грамотно

**Решение:** в MCP-сервере на 4xx-ошибку возвращайте структурированное сообщение:
```json
{
  "error": "invalid_traffic_percentage",
  "message": "traffic_percentage must be 0-100, got -50",
  "valid_range": {"min": 0, "max": 100}
}
```

## D.8 Сдача — типовые проблемы

### Trace screenshot не показывает «рассуждение» агента

**Решение:** в AI Agent ноде включите `Verbose` и `Return Intermediate Steps`. Тогда executions показывают каждый шаг (Thought → Action → Observation).

### Screencast слишком большой для GitHub

GitHub лимит на файл — 100 MB. Альтернативы:
- Loom (бесплатно для 25 видео до 5 мин)
- YouTube unlisted
- Telegram-storage — файл в личке, ссылка в README

## D.9 Если ничего не помогает

1. [n8n Community Forum](https://community.n8n.io) — 90% типовых вопросов уже разобраны
2. [n8n Discord](https://discord.gg/n8n)
3. В чат курса — скриньте n8n executions trace + код, не «всё не работает»
4. Минимальный воспроизводимый пример (workflow JSON + log) — лучшая инвестиция времени

---

# Appendix E — Defensive Guard GCAO (бонус, для HITL)

> **Назначение:** перед критическим действием решает нужна ли human approval. Используется в HITL-расширении (бонус, не обязательно).

```
Goal:
Решить — нужна ли human approval перед предполагаемым действием с feature flag.

Context:
- Action: {{$json.action}}
- Target state: {{$json.target_state}}
- Traffic percentage: {{$json.traffic_percentage}}
- Текущее состояние: {{$json.current_state}}
- Production-критичность фичи: {{$json.is_critical}} (true/false, из метаданных)
- Время суток: {{$json.local_time}} (для отметки внерабочих часов)

Action:
Оцени риск действия по критериям:
1. Действие необратимо? (Disabled requires manual re-enable)
2. Затрагивает production-критичную фичу? (is_critical=true)
3. Снижение traffic > 25% за один шаг?
4. Время вне рабочих часов (риск что некому реагировать на обратные эффекты)?
5. Действие "rollback" в Enabled-режиме (фактическая деактивация production)?

Если 2+ из этих критериев — нужна approval.
Если 1 или 0 — auto-execute разрешён.

Output:
JSON строго по схеме:
{
  "requires_approval": boolean,
  "risk_factors": string[] (список сработавших критериев на русском),
  "auto_execute_allowed": boolean,
  "approval_message": string (короткий текст для Telegram approval-кнопки) | null
}

Constraints:
- Если is_critical=true И action="rollback" — ВСЕГДА requires_approval=true.
- approval_message формата: "Подтвердите действие: {{action}} для {{feature_name}}? Risk factors: {{factors}}."
```

### Где использовать

- В WF1 / WF2 как **первая** AI Agent нода (до основного агента)
- Если `requires_approval=true` → Wait-нода → Telegram approval message с кнопками Approve/Decline
- Если `requires_approval=false` → переходим к основному agent

---

*M5 — HSS AI-dev L1. Дедлайн и способ сдачи — в чате курса. Дополнения принимаются — пишите в чат курса.*