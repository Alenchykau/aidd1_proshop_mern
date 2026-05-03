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