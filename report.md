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
