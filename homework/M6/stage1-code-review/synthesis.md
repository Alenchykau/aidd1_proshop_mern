# Code Review Synthesis — proshop_mern fork (homework M6, Stage 1)

**Date:** 2026-06-01
**Reviewer:** 3-agent team, sequential (security-mate → performance-mate → architecture-mate)
**Scope:** весь репозиторий — `backend/` (Express 4 / Mongoose 5), `frontend/src/` (React 16.13 / classic Redux 4), `mcp-feature-flags/` (Node/TS), `mcp-project-docs/` (Python RAG), `scripts/` (Python RAG-пайплайн). Вне scope: tests/, __tests__/, node_modules, build/dist, docs/project-data/ (RAG-корпус).
**Raw findings:** 20 security + 20 performance + 17 architecture = **57 findings** (`*-findings.jsonl` + `*-review.md` рядом).

---

## HIGH severity (наиболее критичные)

### Кластер A — Broken Access Control в order-flow (самое эксплуатируемое)
- **SEC-001** `backend/controllers/orderController.js:43` — IDOR: любой залогиненный юзер читает чужой заказ по id (утечка адресов, email платежей). *Источники: security-mate; arch-mate (ARCH-002).*
- **SEC-002** `backend/controllers/orderController.js:60` — любой юзер помечает чужой заказ оплаченным с произвольным `paymentResult`, без проверки на стороне PayPal. Прямой вектор финансового фрода. *security-mate + arch-mate (ARCH-003).*
- **SEC-005** `backend/controllers/userController.js:153` — admin `updateUser` пишет `isAdmin` из raw body без валидации/аудита.
- **Корень (arch):** **ARCH-002** (C1) — в проекте нет authorization-слоя; `protect` проверяет только authn, ownership-проверки забыты по-контроллерно.

### Кластер B — features.json: двойной писатель в обход MCP-gateway
- **ARCH-001** (C1) `backend/utils/featureFile.js:4` — backend пишет `features.json` напрямую через `fs.writeFile` в обход feature-flags MCP, который CLAUDE.md объявляет единственным легальным писателем. Два писателя, без межпроцессного лока, с дублированием валидации (drift в одном PR).
- **PERF-005** (HIGH) `backend/utils/featureFile.js:14` — `features.json` читается с диска на каждый GET и ещё раз на каждый write; нет кэша по mtime.
- **PERF-006** (HIGH) `mcp-feature-flags/server.ts:15` — MCP перечитывает файл на каждый tool-вызов; гонка двух писателей может повредить файл. *Это ровно тот пример «direct file write violates AGENTS.md rule», что приведён в спеке.*

### Кластер C — Unauthenticated file upload
- **SEC-008** (HIGH) `backend/routes/uploadRoutes.js:37` — `POST /api/upload` без `protect`/`admin`, без `limits.fileSize`, MIME проверяется по клиентскому заголовку. Любой из интернета грузит файлы.
- **PERF-015** (HIGH/MED) `backend/routes/uploadRoutes.js:30` — нет `limits.fileSize`; multipart блокирует event loop; regex `/jpg|jpeg|png/` не заякорен (матчит `jpgsomething`).
- **ARCH-008** (C1) — роут смешивает infra + handler + response-shaping; возвращает FS-путь в публичный контракт (S3-миграция = breaking change).

### Прочие HIGH
- **SEC-003** `.env:4` — тривиальный `JWT_SECRET='abc123'` подписывает 30-дневные HS256-токены; нет startup-проверки силы секрета.
- **SEC-007** `backend/routes/userRoutes.js:16` — нет rate-limit на `/login` и `/register` (credential stuffing).
- **PERF-001 / SEC-004** `backend/controllers/productController.js:14` — user-controlled `$regex` без escape/anchor/length-cap: ReDoS + match-injection (SEC) И COLLSCAN ~500ms-2s @100k товаров (PERF). *Флагнули security-mate и performance-mate.*
- **PERF-002** `backend/controllers/orderController.js:113` — `GET /api/orders` без пагинации: ~5-10MB / 200-600ms @10k заказов, OOM @100k.
- **PERF-011 / ARCH-006** `frontend/src/screens/OrderScreen.js:42` — мутация Redux-стейта в рендере (`order.itemsPrice = ...`); ломает `useSelector`, удваивает рендеры. *performance-mate + arch-mate.*

---

## MEDIUM severity (сводно)

| ID | Файл | Суть |
|---|---|---|
| SEC-006 | userController.js:86 | нет политики паролей; bcrypt cost 10 |
| SEC-009 | userActions.js:53 | JWT 30д в localStorage, нет CSP/revocation |
| SEC-011 | server.js:25 | нет helmet/CSP/HSTS/CORS/global rate-limit |
| SEC-015 | mcp-feature-flags/server.ts:102 | MCP HTTP transport без auth/CORS/rate-limit |
| SEC-016 | mcp-feature-flags/server.ts:171 | URL-param как ключ объекта (риск prototype pollution) |
| SEC-019 | package.json:29 | EoL/уязвимые версии (mongoose 5, jsonwebtoken 8, multer 1.4.2, express 4.17) |
| PERF-003 | orderController.js:105 | getMyOrders без пагинации/индекса |
| PERF-004 | userController.js:111 | `User.find({})` отдаёт bcrypt-хеши, без пагинации |
| PERF-007/008/009 | mcp-project-docs/scripts | BM25 rebuild на старте, O(N) скан, sequential embed (latent @600 чанков) |
| PERF-010/012 | FeatureListScreen/ProductListScreen | per-keystroke filter без debounce; re-dispatch storms |
| PERF-014 | authMiddleware.js:17 | `User.findById` на каждый protected-запрос (+30-80ms/стр) |
| PERF-017 | productModel.js:19 | нет Mongo-индексов на горячих полях |
| ARCH-004/005/010/011/013/014/015 | разн. | нет сервисного слоя; нет axios-клиента; authn/authz каналы смешаны (401 вместо 403); persistence boundary размазан; polyglot-границы по relative-path/sys.path без контракта; нет route-level authz в SPA |

## LOW severity (сводно)
SEC-010 (stack trace при !production), SEC-012 (log flooding на bad token), SEC-013 (user enumeration на register), SEC-014 (`/api/config/paypal` без валидации/кэша), SEC-017 (`sys.path.insert` shadowing), SEC-018 (нет audit-логов в prod), SEC-020 (review-comment без bounds). PERF-013/016/018/019/020 (skeleton-аллокации, нет gzip, нет AbortController, двойные reduce, atomicWrite целиком). ARCH-007/009/012/016/017 (гигиена конфигов, error-envelope, дубли редиректов).

---

## Cross-mate observations (находки, флагнутые ≥2 агентами)

1. **`orderController.js:43/60`** — SEC-001/002 (security) = ARCH-002/003 (нет authz-слоя). Лечится архитектурно (authz middleware), не патчем на роут.
2. **`productController.js:14`** — SEC-004 (ReDoS/injection) = PERF-001 (COLLSCAN). **Один фикс** (escape + length-cap + text-index) закрывает обе категории.
3. **`uploadRoutes.js`** — SEC-008 (unauth) + PERF-015 (no fileSize) + ARCH-008 (boundary). Нельзя чинить по отдельности — останется DOS-поверхность.
4. **`featureFile.js` / `mcp-feature-flags/server.ts`** — ARCH-001 (MCP-bypass) + PERF-005/006 (no cache + гонка двух писателей). Корректностная бомба, не только perf.
5. **`OrderScreen.js:42`** — PERF-011 (perf) = ARCH-006 (layer violation). Баг корректности под маской perf.

---

## Рекомендуемый порядок фиксов (топ-5 чинить первыми)

1. **SEC-001 IDOR getOrderById** — самый эксплуатируемый, утечка PII, фикс ~10 строк.
2. **SEC-008 + PERF-015 unauth upload** — remote-unauth, фикс ~5 строк (protect/admin + fileSize + anchor).
3. **SEC-004 + PERF-001 regex search** — dual security+perf, фикс через ручной escape + length-cap (без новых зависимостей).
4. **SEC-002 mark-as-paid ownership** — пара к #1, тот же authz-слой.
5. **ARCH-001/PERF-005 features.json single-writer** — больше по объёму (backend → MCP-client), кандидат в ADR-0004; вне «safe small refactor», берём отдельной задачей.

---

## ⭐ Top-3 для Stage 2

> Выбраны по критерию: критичность × чистая безопасная починка (<200 строк, без новых зависимостей, юнит-тестируемо). Все три — HIGH, разные категории, не задевают публичный API сверх намеренного security-изменения.

| # | File:line | Issue | Recommended fix | Effort | Тип теста |
|---|---|---|---|---|---|
| 1 | `backend/controllers/orderController.js:43` (SEC-001) | IDOR: любой юзер читает чужой заказ | После `Order.findById` вернуть 403, если `order.user != req.user._id && !req.user.isAdmin` | 30m | jest unit (mock Order + req/res), assert 403 vs 200 |
| 2 | `backend/routes/uploadRoutes.js:30,37` (SEC-008 / PERF-015) | Unauth upload, нет лимита размера, неякорный MIME-regex | Добавить `protect, admin`; `limits:{fileSize:2MB,files:1}`; заякорить `/\.(jpe?g\|png)$/i` | 30m | jest unit на `checkFileType` + проверка наличия middleware/limit |
| 3 | `backend/controllers/productController.js:14` (SEC-004 / PERF-001) | User-controlled `$regex`: ReDoS + injection + COLLSCAN | Ручной escape спецсимволов + `keyword.slice(0,64)` перед `$regex` (без новых deps) | 1h | jest unit: спецсимволы экранированы, длина ≤64, поведение совпадения сохранено |

**Замечание по тестам Stage 2:** backend Express test-runner в форке не настроен (есть только frontend jest и Python pytest). Под Stage 2 нужно завести минимальную jest-конвенцию для backend (unit-тесты контроллеров/утилит с замоканными `req`/`res` и моделью — без живой Mongo). Это test-инфра (devDep), а не зависимость самого фикса.

---

## Token usage estimate (cost awareness)

| Агент | subagent tokens | tool calls | duration |
|---|---|---|---|
| security-mate | ~131.8K | 69 | ~55 мин |
| performance-mate | ~183.2K | 74 | ~28 мин |
| architecture-mate | ~146.3K | 54 | ~30 мин |
| **Итого sub-агенты** | **~461K** | 197 | — |

Sequential-режим (Опция A): дешевле параллельного Agent Team, контролируемый порядок, каждый mate видел отчёты предыдущих и ссылался на их id (SEC-/PERF-/ARCH- кросс-рефы).
