# M6 — Шаг 0: карта форка `aidd1_proshop_mern`

> Заполнено один раз по реальной структуре форка. Везде в Stage 1-4, где в шаблонах стоит `<...>` или пример-путь, подставляем значения отсюда.

## Сводная таблица

| Что | Значение в этом форке |
|---|---|
| MCP-сервер (feature flags) | `mcp-feature-flags/server.ts` → компилится в `mcp-feature-flags/dist/server.js` (Node/TS, `@modelcontextprotocol/sdk` + express + zod) |
| RAG / docs-search сервер | `mcp-project-docs/server.py` (Python, `mcp` + `ollama` + `qdrant-client` + `rank-bm25`) |
| RAG-пайплайн (вспом.) | `scripts/build_chunks.py`, `scripts/embed_chunks.py`, `scripts/rag_query.py` + пакет `scripts/build_chunks/` (chunker / enrich / groups / schema / tokens) |
| Слой feature flags | `backend/features.json` (источник истины; правится только через feature-flags MCP) |
| Язык MCP/RAG | **Оба**: feature-flags MCP — Node/TypeScript; project-docs MCP + scripts — Python |
| Test framework | **pytest** (Python: `tests/build_chunks/`, `conftest.py`, в `requirements-rag.txt`) · **jest** (frontend CRA: `npm test --prefix frontend`). Backend Express — раннер не настроен. mcp-feature-flags (TS) — тестов пока нет. |
| Mutation tool (опц.) | Python → `mutmut` · JS → `stryker` (ни один пока не установлен) |
| Файл правил AI-агента | `CLAUDE.md` (корень) + `DESIGN.md` (design rules) + папка `.claude/` (agents, settings) |
| Папка существующих docs | `docs/` |
| Папка ADR | **`docs/adr/`** — текущие ADR этого форка (0001 jwt-localstorage, 0002 single-process-prod, 0003 runtime-paypal-id). ⚠️ Отдельно `docs/project-data/adrs/` (adr-001..005) — это **синтетический RAG-корпус** (решения исходного Brad Traversy proshop), не настоящие ADR форка. |

## Подпроекты (для Stage 1/3 — ревьюим весь репозиторий)

| Модуль | Путь | Стек | Роль |
|---|---|---|---|
| Backend API | `backend/` | Node + Express 4 + Mongoose 5 (ESM) | REST API: products / users / orders / upload / config + auth middleware |
| Frontend | `frontend/` | React 16.13 + classic Redux 4 + RRv5 (CRA 3.4) | SPA + Feature Dashboard (M4) |
| Feature-flags MCP | `mcp-feature-flags/` | Node/TypeScript | MCP-сервер управления `backend/features.json` |
| Project-docs MCP (RAG) | `mcp-project-docs/` | Python | MCP vector-search по `docs/` (qdrant + ollama + BM25) |
| RAG-пайплайн | `scripts/` | Python | Чанкинг / эмбеддинг / запросы для project-docs |
| Feature flags data | `backend/features.json` | JSON | Источник истины фичефлагов |

## Существующие docs (вход для Stage 3 Phase 1.5 — аудит ✅/🔄/📦/❌)

- `docs/adr/` — 3 ADR форка (актуальны)
- `docs/architecture.md` — high-level overview
- `docs/chunks.jsonl` — артефакт RAG-чанкинга (генерируемый)
- `docs/project-data/` — большой синтетический корпус для RAG (api/, features/, pages/, runbooks/, incidents/, adrs/, glossary, dev-history, best-practices) — это **данные**, не живая дока проекта
- `docs/superpowers/plans|specs/` — планы и спеки прошлых модулей (M3-M5) — историческое

## Стек для spawn-промптов агентов (копипаст-блок)

```
- Репозиторий: форк proshop_mern (MERN) + MCP feature-flags (Node/TS) + RAG project-docs (Python) + RAG-пайплайн (Python scripts/)
- Стек: Node + Express + Mongoose 5 + MongoDB + React 16.13 + classic Redux 4 + TypeScript (MCP) + Python (RAG)
- Файл правил агента (прочитать ПЕРВЫМ): CLAUDE.md + DESIGN.md
- ADR-папка (прочитать ПЕРВОЙ): docs/adr/  (НЕ docs/project-data/adrs/ — это RAG-корпус)
- Авторизация: JWT (HS256, 30д, localStorage), пароли через bcryptjs
- Test framework: pytest (Python) / jest (frontend)
- Вне scope ревью: tests/, **/__tests__/, scripts/ (по желанию), frontend/public/, node_modules/, build/dist, mcp-*/dist/, mcp-*/node_modules/
```
