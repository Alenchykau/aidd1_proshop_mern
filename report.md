# M2 — Report

Запустил локально. MongoDB установил локально с MongoDB Community (пробовал free tier atlas - не получилось настроить, аи говорит, что проблема в впн) + npm run dev

## IDE
- Primary (с ней я работал основной): Claude Code → rules в `CLAUDE.md`

## Rules diff (что добавил руками поверх auto-generated)

Добавлены секции **Tech Stack** (пины + "don't migrate"-лист), **Conventions** (naming, imports, error handling, Redux pattern, commit rules `course: <type>:`) и **Gotchas & Deployment Quirks**. Секция **Architecture** подрезана, **Notes** удалена.


## 3 вопроса
- Сколько заняло бы вручную: вручную не смог бы сделать
- Самая магическая функция IDE: не конкретно IDE, а работа с AI в целом - человек без реального опыта в разработке может разобраться в проекте, найти баги и исправить их, и т.д.
- Где AI сломал и как пофиксил: AI помог разобраться в проблемах с VPN, с mongo db, с зависимостями, с mermaid диаграммами, найти баги в коде и исправить их

## M3

### Reflection

IDE: Antigravity + Claude Code
Стек: один mcp сервер на js/ts, потому что я хотел придерживаться стека проекта, второй на python, так как claude убедил меня, что этот выбор будет лучше. БД для RAG - qdrant, embedding-модель - BGE-M3 через ollama. 

Судя по всему, была ошибка при чанкинге, т.к. получилось ~600 чанков вместо ожидаемых ~300 и с одним из тестов были проблемы - по запросу подтягивались нерелевантные документы. claude предложил реализовать Hybrid retrieval и проблему получилось исправить. 

В целом это д/з оказалось сложнее, чем предыдущее, на уровне концепта я понимаю MCP, RAG и т.д. но на практике увидел и потрогал это впервые.


### Feature flags MCP

Полный лог проверки и канареечного раскатывания фичи `search_v2` через `feature-flags` MCP-сервер.

**Шаг 1. Чтение текущего состояния.**

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "search_v2" }
```
Ответ MCP:
```json
{
  "feature_name": "search_v2",
  "name": "New Search Algorithm",
  "description": "Replaces legacy regex-based keyword matching with a hybrid BM25 + TF-IDF ranking pipeline. Improves relevance for multi-word queries and handles common misspellings via fuzzy matching. Backend: new productController search path; index built on name, brand, category, description fields.",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-02",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary",
  "dependencies_state": []
}
```
Вывод: фича уже в статусе `Testing`, не в `Disabled`. Условный переход `Disabled → Testing` не требуется, `set_feature_state` не вызывался. Трафик уже 25%, но для явного подтверждения вызвал `adjust_traffic_rollout`.

**Шаг 2. Установка трафика на 25%.**

Tool call: `mcp__feature-flags__adjust_traffic_rollout`
Аргументы:
```json
{ "feature_name": "search_v2", "percentage": 25 }
```
Ответ MCP:
```json
{
  "feature_name": "search_v2",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-03",
  "hint": null
}
```
Поле `last_modified` обновилось с `2026-05-02` на `2026-05-03`, статус и процент не изменились (идемпотентный вызов).

**Шаг 3. Финальная верификация.**

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "search_v2" }
```
Ответ MCP:
```json
{
  "feature_name": "search_v2",
  "name": "New Search Algorithm",
  "description": "Replaces legacy regex-based keyword matching with a hybrid BM25 + TF-IDF ranking pipeline. Improves relevance for multi-word queries and handles common misspellings via fuzzy matching. Backend: new productController search path; index built on name, brand, category, description fields.",
  "status": "Testing",
  "traffic_percentage": 25,
  "last_modified": "2026-05-03",
  "targeted_segments": ["beta_users", "internal"],
  "rollout_strategy": "canary",
  "dependencies_state": []
}
```

**Итоговое состояние `search_v2`:**
- status: `Testing`
- traffic_percentage: `25`
- last_modified: `2026-05-03`
- rollout_strategy: `canary`
- targeted_segments: `beta_users`, `internal`
- dependencies_state: пусто (зависимостей нет)

---

Полный лог отключения фичи `multi_step_checkout_v2` через тот же MCP-сервер.

**Шаг 1. Чтение текущего состояния.**

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "multi_step_checkout_v2" }
```
Ответ MCP:
```json
{
  "feature_name": "multi_step_checkout_v2",
  "name": "Redesigned Multi-Step Checkout",
  "description": "Replaces the current 4-step linear checkout (CheckoutSteps component) with a validated stepper that shows a progress indicator, allows backward navigation without data loss, and provides inline address validation. Shipping, payment, and order review are on separate animated panels rather than full page redirects.",
  "status": "Testing",
  "traffic_percentage": 20,
  "last_modified": "2026-04-10",
  "targeted_segments": ["all"],
  "rollout_strategy": "ab_test",
  "dependencies_state": []
}
```
Вывод: фича в статусе `Testing` с 20% трафика — её нужно перевести в `Disabled`.

**Шаг 2. Перевод в Disabled.**

Tool call: `mcp__feature-flags__set_feature_state`
Аргументы:
```json
{ "feature_name": "multi_step_checkout_v2", "state": "Disabled" }
```
Ответ MCP:
```json
{
  "feature_name": "multi_step_checkout_v2",
  "status": "Disabled",
  "traffic_percentage": 0,
  "last_modified": "2026-05-03",
  "dependencies_state": []
}
```
По контракту MCP перевод в `Disabled` автоматически выставляет `traffic_percentage=0`, поэтому отдельный вызов `adjust_traffic_rollout` не нужен (более того, MCP запрещает `percentage > 0` для `Disabled`-фичи — `DISABLED_TRAFFIC_LOCKED`).

**Шаг 3. Финальная верификация.**

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "multi_step_checkout_v2" }
```
Ответ MCP:
```json
{
  "feature_name": "multi_step_checkout_v2",
  "name": "Redesigned Multi-Step Checkout",
  "description": "Replaces the current 4-step linear checkout (CheckoutSteps component) with a validated stepper that shows a progress indicator, allows backward navigation without data loss, and provides inline address validation. Shipping, payment, and order review are on separate animated panels rather than full page redirects.",
  "status": "Disabled",
  "traffic_percentage": 0,
  "last_modified": "2026-05-03",
  "targeted_segments": ["all"],
  "rollout_strategy": "ab_test",
  "dependencies_state": []
}
```

**Итоговое состояние `multi_step_checkout_v2`:**
- status: `Disabled`
- traffic_percentage: `0`
- last_modified: `2026-05-03`
- rollout_strategy: `ab_test`
- targeted_segments: `all`
- dependencies_state: пусто (зависимостей нет)

---

Полный лог запуска канарейки фичи `gift_message` через тот же MCP-сервер.

**Шаг 1. Чтение текущего состояния.**

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "gift_message" }
```
Ответ MCP:
```json
{
  "feature_name": "gift_message",
  "name": "Gift Message at Checkout",
  "description": "Adds an optional gift message textarea on the PlaceOrderScreen. The message is stored on the Order document (orderModel extension: giftMessage: String) and printed on the packing slip. Increases average order value for gift-occasion purchases.",
  "status": "Disabled",
  "traffic_percentage": 0,
  "last_modified": "2026-02-20",
  "targeted_segments": ["all"],
  "rollout_strategy": "full_release",
  "dependencies_state": []
}
```
Вывод: фича в `Disabled` (то есть «не включена») — нужно перевести в `Testing` с трафиком 10%.

**Шаг 2. Перевод в Testing.**

Tool call: `mcp__feature-flags__set_feature_state`
Аргументы:
```json
{ "feature_name": "gift_message", "state": "Testing" }
```
Ответ MCP:
```json
{
  "feature_name": "gift_message",
  "status": "Testing",
  "traffic_percentage": 10,
  "last_modified": "2026-05-03",
  "dependencies_state": []
}
```
По контракту MCP при переходе из `Disabled` в `Testing` сервер выставляет дефолтный трафик 10% (правило «keep if 1-99 else 10»). Запрошенное значение совпало с дефолтом, поэтому отдельный `adjust_traffic_rollout` не понадобился.

**Шаг 3. Финальная верификация.**

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "gift_message" }
```
Ответ MCP:
```json
{
  "feature_name": "gift_message",
  "name": "Gift Message at Checkout",
  "description": "Adds an optional gift message textarea on the PlaceOrderScreen. The message is stored on the Order document (orderModel extension: giftMessage: String) and printed on the packing slip. Increases average order value for gift-occasion purchases.",
  "status": "Testing",
  "traffic_percentage": 10,
  "last_modified": "2026-05-03",
  "targeted_segments": ["all"],
  "rollout_strategy": "full_release",
  "dependencies_state": []
}
```

**Итоговое состояние `gift_message`:**
- status: `Testing`
- traffic_percentage: `10`
- last_modified: `2026-05-03`
- rollout_strategy: `full_release`
- targeted_segments: `all`
- dependencies_state: пусто (зависимостей нет)

### End-to-end

Связка двух MCP в одной задаче: «найди фичу `payment_stripe_v3` в документации, проверь её состояние, и если она `Disabled` с не-`Disabled` зависимостями — переведи в `Testing` с трафиком 25%, в конце процитируй документацию о назначении фичи».

Ожидаемая цепочка по ТЗ: `search_project_docs` → `get_feature_info` → анализ зависимостей → `set_feature_state` → `adjust_traffic_rollout` → `get_feature_info` (подтверждение) → цитата.

**Фактический результат: цепочка обрывается на шаге 2.** Фичи `payment_stripe_v3` не существует ни в `features.json`, ни в корпусе документации. `set_feature_state` / `adjust_traffic_rollout` НЕ вызывались — это корректное поведение (нечего переводить).

---

**Шаг 1. Поиск в документации (`project-docs` MCP).**

Tool call: `mcp__project-docs__search_project_docs`
Аргументы:
```json
{ "query": "payment_stripe_v3 feature dependencies", "top_k": 5 }
```
Top-5 результата (только `score` + путь):
```
0.0315  docs/project-data/features/payments.md         → PayPal Payment Button (Feature 2)
0.0305  docs/project-data/feature-flags-spec.md        → features.json формат, optional fields
0.0297  docs/project-data/feature-flags-spec.md        → каталог флагов, секция Payments
0.0289  docs/project-data/runbooks/local-setup.md      → npm install, root deps
0.0286  docs/project-data/runbooks/local-setup.md      → npm install --prefix frontend
```
Все score < 0.04 (для сравнения: точные попадания в M3 → шаг 4 показывали 0.55–0.66). Top-1 — PayPal-фича, не Stripe. Прямого совпадения по `payment_stripe_v3` нет.

**Шаг 2. Чтение состояния флага (`feature-flags` MCP).**

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "payment_stripe_v3" }
```
Ответ MCP:
```json
{ "error": "FEATURE_NOT_FOUND", "feature_name": "payment_stripe_v3" }
```

**Решение: цепочка прервана.** Нельзя анализировать зависимости несуществующего флага и нельзя вызывать `set_feature_state` — MCP вернёт `FEATURE_NOT_FOUND` и для записи. Никаких write-операций не совершено.

---

**Дополнительная диагностика (вне основной цепочки)** — проверить, что это не опечатка в имени, а реально отсутствующий флаг.

Tool call: `mcp__project-docs__search_project_docs`
Аргументы:
```json
{ "query": "Stripe payment integration v3", "top_k": 5 }
```
Top-3 (упрощённо):
```
0.0323  adrs/adr-004-paypal-vs-stripe.md  → "Migration Path" (как мигрировать на Stripe)
0.0320  adrs/adr-004-paypal-vs-stripe.md  → "Current Assessment (April 2026)"
0.0320  features.json                     → "Stripe as Alternative Payment Processor" (flag: stripe_alternative)
```

Tool call: `mcp__project-docs__search_project_docs`
Аргументы:
```json
{ "query": "stripe_alternative feature flag", "top_k": 5 }
```
Top-1: `features.json#stripe_alternative` (score 0.0328) — **это и есть «реальный» Stripe-флаг в проекте**.

Контрольный grep по `docs/` на литерал `payment_stripe_v3` — 0 совпадений. Имя в задаче — фиктивное / опечатка, реальный кандидат — `stripe_alternative`.

Для полноты — состояние реального аналога:

Tool call: `mcp__feature-flags__get_feature_info`
Аргументы:
```json
{ "feature_name": "stripe_alternative" }
```
Ответ MCP:
```json
{
  "feature_name": "stripe_alternative",
  "name": "Stripe as Alternative Payment Processor",
  "description": "Enables the Stripe payment method option that is currently commented out in PaymentScreen.js. Adds a Stripe checkout backend route to orderController and handles webhooks for async payment confirmation. Acts as a fallback when PayPal is unavailable and provides credit card tokenization independent of PayPal.",
  "status": "Testing",
  "traffic_percentage": 5,
  "last_modified": "2026-04-05",
  "targeted_segments": ["beta_users"],
  "rollout_strategy": "canary",
  "dependencies_state": []
}
```

Даже если бы я подменил имя на `stripe_alternative`, условие задачи «status == Disabled» НЕ выполняется (`stripe_alternative` уже в `Testing` 5%). Никакой write-вызов тут не уместен — ни по фейковому имени, ни по угаданному реальному.

---

**Цитаты из документации о назначении Stripe-альтернативы** (раз `payment_stripe_v3` отсутствует, цитируем ближайший канон — описание `stripe_alternative` и ADR-004 «PayPal vs Stripe», `docs/project-data/adrs/adr-004-paypal-vs-stripe.md`):

> **Acts as a fallback when PayPal is unavailable and provides credit card tokenization independent of PayPal.**
> — `features.json#stripe_alternative`, поле `description`

> **Stripe is now the team's preferred payment processor for new projects.** Key advantages over PayPal: Test mode is a faithful replica of production… The double-callback incident (i-001) would have been surfaced and verifiable in Stripe's test environment. Stripe Elements / Stripe Checkout — card entry inline within the application UI (no popup/redirect)… Idempotency keys are a first-class concept in Stripe's API, making idempotent payment flows natural to implement (the core issue in i-001).
> — ADR-004, секция *Alternatives Considered → Stripe*

> The PayPal integration is stable in production (since v2.1)… However, if this application were being started today or rebuilt, **Stripe would be the unambiguous choice** for its superior sandbox fidelity, API design, and webhook reliability.
> — ADR-004, секция *Current Assessment (April 2026)*

---

**Итоговое состояние `payment_stripe_v3`: фича не существует, изменений в `features.json` не было.** Цепочка корректно остановилась на `FEATURE_NOT_FOUND` — это и есть желаемое поведение: MCP-сервер защищает от «случайных» write-операций по несуществующим именам, а агент не подменяет имя самостоятельно.

**Замечания по работе MCP в связке:**

- `project-docs` корректно НЕ нашёл `payment_stripe_v3` (max score 0.0315 — на порядок ниже типичных «попаданий» 0.55+ из M3 шага 4). Низкий top-1 score — сильный сигнал «этого нет», но порог не формализован, агент должен интерпретировать score сам.
- `feature-flags` чисто отрабатывает FEATURE_NOT_FOUND и для read, и (как контракт обещает) для write — никаких побочных эффектов.
- Связка работает: вектор-поиск даёт контекст («что такое фича X»), feature-flags даёт runtime-состояние. Они не дублируют друг друга — `get_feature_info` НЕ возвращает текст из документации, `search_project_docs` НЕ возвращает текущий `traffic_percentage`. Чтобы ответить на «что такое фича X и какое у неё состояние» — нужны оба.

## Task 3 — Step 2: Vector DB chunking

- Local Qdrant (v1.17.1) installed at `D:\Soft\qdrant\` (no Docker).
- Documentation moved to `docs/project-data/` (preserved git history via `git mv`).
- Chunking pipeline in `scripts/build_chunks/` + entrypoint `scripts/build_chunks.py`.
- Final artifact: `docs/chunks.jsonl` — 604 chunks across 7 dispatch groups (top-level/208, pages/126, features/94, runbooks/70, api/46, adrs/35, incidents/25). Languages: 508 en / 72 mixed / 24 ru.
- Pipeline: deterministic chunker (Python, 39 unit tests) → parallel Sonnet subagents per group enrich summary/keywords/language → validator merges into single JSONL.
- Design spec: `docs/superpowers/specs/2026-05-03-vector-db-chunking-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-05-03-vector-db-chunking.md`.

## Task 3 — Step 4: RAG query тестирование

Embedding-модель: BGE-M3 через локальный Ollama (`http://localhost:11434`), dim=1024, cosine distance. Vector store: Qdrant `proshop_chunks`, 604 точки. Query script: `scripts/rag_query.py`.

### Запрос 1 — factual single-hop

```
$ python scripts/rag_query.py "Какая БД используется в proshop_mern и почему именно она?" --top-k 3
```

```
[0.664] dev-history#20         (top-level) — Five major decisions documented: MongoDB over PostgreSQL, ...
[0.655] architecture#1         (top-level) — ProShop is a full-stack MERN e-commerce app ...
[0.653] best-practices#1       (top-level) — ProShop v1 was deprecated due to CRA, classic Redux ...
```

Ожидался `adrs/adr-001-mongodb-vs-postgres`. В top-3 пришли мета-документы (history/architecture), которые тоже отвечают на вопрос. ADR-001 не попал даже в top-5 — chunking разбил его на 6 коротких чанков, и ни один из них индивидуально не побивает dev-history#20, где «MongoDB over PostgreSQL» сжато в один плотный chunk. Решения для production: reranker, hybrid search (BM25+vector), либо не дробить короткие ADR.

### Запрос 2 — multi-hop dependency (несуществующий флаг)

```
$ python scripts/rag_query.py "Какие фичи зависят от payment_stripe_v3?" --top-k 3
```

```
[0.669] adrs/adr-004-paypal-vs-stripe#4    (adrs)       — Alternatives to PayPal considered, with Stripe ...
[0.664] adrs/adr-004-paypal-vs-stripe#5    (adrs)       — Migration path to Stripe ...
[0.652] features.json#stripe_alternative   (top-level)  — stripe_alternative flag enables the commented-out Stripe ...
```

Флага `payment_stripe_v3` в корпусе **нет** — реальный флаг `stripe_alternative`. Система не галлюцинирует, а тянет ближайшее по смыслу: ADR-004 (PayPal vs Stripe) и `features.json#stripe_alternative`. Не попал в top-3 `features.json#apple_pay`, который depends on `stripe_alternative` — увеличение top-k или фильтр `group=top-level` подтянули бы его.

### Запрос 3 — filter by group + retrieval

```
$ python scripts/rag_query.py "Что случилось во время последнего incident с checkout?" --top-k 3 --group incidents
```

```
[0.579] incidents/i-001-paypal-double-charge#2     (incidents) — Detailed event timeline for the PayPal double-charge ...
[0.551] incidents/i-001-paypal-double-charge#4     (incidents) — Root cause analysis showing the pay endpoint lacked ...
[0.547] incidents/i-002-mongo-connection-pool-... (incidents) — Summarizes the Black Friday P0 outage ...
```

Pre-filter `group=incidents` сужает пул до 25 чанков, поэтому абсолютные score ниже (0.55–0.58). Top-1 — PayPal double-charge incident, что и есть «checkout incident». Top-3 — 2 чанка про PayPal + 1 про MongoDB pool exhaustion (формально не checkout, но Black Friday checkout-критичный outage).

### Выводы по тестам

- **Языковая инвариантность**: en+ru запросы работают одинаково (BGE-M3 multilingual оправдывает выбор).
- **Pre-filter работает**: `group=incidents` корректно сужает поиск до нужного типа.
- **Recall на ADR-документах слабый** из-за раздробленного chunking — известный trade-off, фиксится reranker-ом или hybrid search вне рамок этой задачи.
- **Отсутствие галлюцинаций**: по запросу о несуществующем флаге система возвращает близкие по смыслу чанки, не выдумывает.

## Task 3 — Step 5: Починка recall (hybrid retrieval)

### Проблема

Запрос 1 («Какая БД используется в proshop_mern и почему именно она?») возвращал в top-5 только мета-документы (`dev-history#20`, `architecture#1`, `best-practices#1`). Канонический источник — `adrs/adr-001-mongodb-vs-postgres` — не попадал даже в top-50.

Диагностика прямой cosine-проверкой:

```
ADR-001 chunks vs query:    0.43–0.55
Meta-docs vs query:          0.63–0.66
```

Разрыв 15–20 пунктов. Причины:

1. **Chunking trade-off**: ADR-001 разбит на 6 коротких секционных чанков (Header / Context / Decision / Consequences / Alternatives / Assessment). В каждом мало плотности «MongoDB+решение+причина», тогда как `dev-history#20` за один 50-токенный чанк содержит «Five major decisions documented: MongoDB over PostgreSQL, …».
2. **Cross-lingual gap**: запрос на русском, корпус ADR — на английском. Слово «БД» лексически не пересекается с «MongoDB», а семантически BGE-M3 предпочитает summary-style тексты («ProShop is a full-stack MERN e-commerce app…») точечным секционным.
3. **Тело ADR-чанков содержит технические детали** (Mongoose schemas, `connectDB`, `useCreateIndex`), которые семантически удаляют embedding от плоского вопроса «которая БД».

### Что попробовали

| Подход | Результат |
|---|---|
| Contextual embedding prefix (title + summary + keywords + text) | Не помогло. ADR-001 остался ниже 0.50, мета-доки 0.60+. |
| Summary-only embedding (отбросить body) | Сузил разрыв (ADR 0.43–0.46 vs мета 0.50–0.62), но не дотянул. |
| Hybrid retrieval (dense + BM25, RRF k=60) | **Сработало** для запросов с явными ключевыми словами; cross-lingual запрос 1 — частично. |

### Финальная реализация

`scripts/rag_query.py` — `HybridRetriever`:
- Dense: BGE-M3 через Qdrant (`prefetch_limit=50`).
- BM25: `rank_bm25.BM25Okapi` поверх `title + summary + keywords + text` всех 604 чанков (in-memory, build <100мс).
- Fusion: Reciprocal Rank Fusion, `score = Σ 1/(k + rank_i)`, k=60.
- CLI: `--mode hybrid|dense|bm25` (default hybrid).

### Сравнение результатов

| Запрос | Dense (было) | Hybrid (стало) | Эффект |
|---|---|---|---|
| 1. «Какая БД и почему?» | dev-history#20 (0.664) | best-practices#1 (0.0307) | ~ Не сдвинулось из-за cross-lingual gap. На английском «Why MongoDB chosen as database?» — все 5 чанков ADR-001 в top-5. |
| 2. «Зависит от payment_stripe_v3?» | adrs/adr-004#4 (Stripe-альтернативы) | features/checkout#3 + features/payments#12,#13 | ✓ Тянет реализующие фичи, а не теоретический ADR |
| 3. «Incident с checkout?» | i-001#2 + i-001#4 + i-002#1 (Mongo pool) | i-001#0 + i-001#3 + i-001#2 (всё про PayPal) | ✓ Все 3 из релевантного incident'а |

### Что осталось

Query 1 в исходной формулировке упирается в фундаментальный cross-lingual gap: ни одно слово запроса не пересекается с текстом ADR. Полностью лечится **query expansion** через локальный chat-LLM (rephrase + перевод на язык корпуса) — отложено вне scope.

## M4 — Redesign

Дизайн-система: ProShop Tech-Minimal Dark (см. `DESIGN.md`). Подход —
семантические CSS-токены на `:root` (light) и `.dark` (dark), функциональный
переключатель тем в Header, OS preference как fallback. Bootstrap 4
переведён на токены через `bootstrap-overrides.css`, поэтому легаси-экраны
меняют тему вместе с редизайн-экранами.

Стратегия — гибрид: сначала общие atoms (`Card`, `Button`, `FormField`,
`FormCard`, `DataTable`, `Pagination`, `Badge`, `ThemeToggle`), потом
per-screen редизайн в порядке public → auth → admin. Восемь групповых
ASCII-wireframes в спеке Phase 0 покрывают все 16 экранов как шаблоны.

Phase split: Phase 0 — Foundation (этот PR). Phase 1 — Public.
Phase 2 — Auth/Checkout. Phase 3 — Admin.

| #  | Page                       | Route                              | File                       | Видимость | Сделал?           |
|----|----------------------------|------------------------------------|----------------------------|-----------|-------------------|
| 1  | Home / Search results      | /, /search/:keyword, /page/:n      | HomeScreen.js              | public    | [ ]               |
| 2  | Product details            | /product/:id                       | ProductScreen.js           | public    | [ ]               |
| 3  | Cart                       | /cart/:id?                         | CartScreen.js              | public    | [ ]               |
| 4  | Login                      | /login                             | LoginScreen.js             | public    | [ ]               |
| 5  | Register                   | /register                          | RegisterScreen.js          | public    | [ ]               |
| 6  | Profile                    | /profile                           | ProfileScreen.js           | auth      | [ ]               |
| 7  | Shipping                   | /shipping                          | ShippingScreen.js          | auth      | [ ]               |
| 8  | Payment                    | /payment                           | PaymentScreen.js           | auth      | [ ]               |
| 9  | Place Order                | /placeorder                        | PlaceOrderScreen.js        | auth      | [ ]               |
| 10 | Order details              | /order/:id                         | OrderScreen.js             | auth      | [ ]               |
| 11 | Admin: Users list          | /admin/userlist                    | UserListScreen.js          | admin     | [ ]               |
| 12 | Admin: User edit           | /admin/user/:id/edit               | UserEditScreen.js          | admin     | [ ]               |
| 13 | Admin: Products list       | /admin/productlist                 | ProductListScreen.js       | admin     | [ ]               |
| 14 | Admin: Product edit        | /admin/product/:id/edit            | ProductEditScreen.js       | admin     | [ ]               |
| 15 | Admin: Orders list         | /admin/orderlist                   | OrderListScreen.js         | admin     | [ ]               |
| 16 | Admin: Feature Dashboard   | /admin/featuredashboard            | FeatureDashboardScreen.js  | admin     | [x] обязательно   |

(Phase 0 — Foundation сама по себе галочки в таблице не ставит — это
инфраструктура. Phase 1/2/3 будут отмечать по мере сдачи.)
