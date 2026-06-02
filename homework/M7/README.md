# M7 — Приватный AI-ассистент с роутером по чувствительности (+ инъекции)

Капстоун M7: чат-ассистент в `proshop_mern`, который **маршрутизирует запросы по PII**
(приватные → локальная модель, публичные → облако), ходит в **БД магазина** scoped-тулами и
**логирует всё в админ-дашборд**. Плюс DZ2 — prompt-инъекция и архитектурная защита.

Дизайн: [`m7-design.md`](./m7-design.md) · План: [`m7-implementation-plan.md`](./m7-implementation-plan.md)

## Что выбрано (и почему)
- **Локальная модель:** Ollama, **`qwen3.5:4b`** (Q4_K_M) — лёгкая, tools надёжны, большой контекст.
  Сравнение с `gemma4:e4b` и обоснование — в [`0-deploy.md`](./0-deploy.md).
- **Облако:** OpenRouter (один ключ → все модели).
- **Роутер:** n8n (webhook). **PII-детект:** regex (email/телефон/карта) + лёгкая LLM-нода на
  `qwen3.5:4b` (имена, в т.ч. кириллица). Роутеру GPU не нужен.
- **Путь виджета → роутер:** Express-прокси `POST /api/assistant/chat` (за `protect`) —
  доверенный `userId`/JWT из `req.user`, webhook не светится в браузер.
- **Логи:** n8n пишет в Mongo-коллекцию `chatlogs`; дашборд читает через
  `GET /api/assistant/logs` (admin).

## Предусловия
- `.env` в корне: `NODE_ENV, PORT, MONGO_URI, JWT_SECRET, PAYPAL_CLIENT_ID` +
  `N8N_ASSISTANT_WEBHOOK_URL`, `ASSISTANT_VULNERABLE_MODE` (см. `.env.example`).
- **MongoDB** запущен и засеян: `npm run data:import`.
- **Ollama** запущен; модель скачана: `ollama pull qwen3.5:4b` (endpoint `http://localhost:11434`).
- **n8n** установлен глобально: `npm install -g n8n@2.21.7`.

## Как запустить (PowerShell, каждое окно — из КОРНЯ репо)

### ⚠️ Окно 1 — n8n (UI на http://localhost:5678) — ВАЖНО
n8n хранит owner-аккаунт, БД, workflow'ы и credentials в одной папке. Привязываем её к проекту через
`N8N_USER_FOLDER`. **Без этой переменной `n8n start` поднимет НОВЫЙ инстанс в `%USERPROFILE%\.n8n` —
аккаунт, M5-workflow и credentials «пропадут»** (просто окажутся в другой папке). Это и была прошлая
проблема.
```powershell
$env:N8N_USER_FOLDER = "$PWD\n8n-data"
$env:N8N_RESTRICT_FILE_ACCESS_TO = "$PWD\homework\M7"   # опционально для M7 (file-ноды не нужны)
n8n start
```
> Не запускать `n8n start` без `N8N_USER_FOLDER`. Не редактировать файлы в `n8n-data/.n8n/` руками.
> Папка `n8n-data/` — в `.gitignore`.

### Окно 2 — backend API (:5000) + фронт (:3000)
```powershell
npm run dev
```
(Ollama и MongoDB должны быть уже подняты до этого.)

## Подключение роутера (после старта n8n)
1. В n8n заведи credentials: **Ollama** (`http://localhost:11434`), **OpenRouter** (API key),
   **MongoDB** (твой `MONGO_URI`).
2. Импортируй workflow из [`router/workflow.json`](./router/), привяжи credentials, **активируй**.
3. Скопируй Production webhook URL → пропиши в `.env` как `N8N_ASSISTANT_WEBHOOK_URL`,
   перезапусти backend.
4. Залогинься в магазине → чат-виджет 💬 справа внизу. Админ → меню Admin → **AI Router** (дашборд).

## Артефакты (карта)
- [`0-deploy.md`](./0-deploy.md) — локальная модель: железо, квант, сравнение, лог вызовов. ✅
- `router/` — экспорт n8n workflow.json. _(Фаза 2)_
- `demo/` — пруф работы на 6–10 запросах (скрины/логи). _(Фаза 4)_
- `writeup-dz1.md` — разбор DZ1 (+ «подвох» приватности). _(Фаза 4)_
- `dz2/` — уязвимый артефакт + логи before/after + `writeup-dz2.md`. _(Фаза 5)_
