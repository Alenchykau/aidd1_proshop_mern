# 2. Single-process production: Express serves both API and SPA

- Status: Accepted
- Date: implicit (project inception)
- Confidence: **HIGH** (явно в коде: `backend/server.js`, `package.json` `heroku-postbuild`, `Procfile`, `frontend/package.json` `proxy`)

## Context

Нужно было задеплоить MERN на одну Heroku-dyno (один web-процесс на Procfile) без CDN, без отдельного фронтового хостинга, без CORS-настройки. Dev-режим при этом должен оставаться удобным: hot-reload фронта на `:3000`, API на `:5000`.

## Decision

**В dev** — два процесса через `concurrently`:
- `npm run server` поднимает Express на `:5000`,
- `npm run client` поднимает CRA dev-server на `:3000`,
- `frontend/package.json` указывает `"proxy": "http://127.0.0.1:5000"` → `/api/*`-запросы CRA-прокси перебрасывает на бэк, поэтому фронт пишет относительные URL'ы.

**В prod** — один процесс (`Procfile`: `web: node backend/server.js`):
- `heroku-postbuild` ставит фронтовые deps (`NPM_CONFIG_PRODUCTION=false`) и собирает `frontend/build`.
- `backend/server.js` под `NODE_ENV === 'production'` подключает `express.static('frontend/build')` и регистрирует SPA-fallback `app.get('*', ...)` → `frontend/build/index.html`.
- API и SPA живут на одном origin, поэтому `cors` не подключён.

Статика для пользовательских картинок (`/uploads/*`) обслуживается тем же процессом через `express.static('uploads')`.

## Alternatives

- **FE на Netlify/Vercel + BE как отдельный API** — потребовало бы CORS-настроек (нет `cors` в deps, нет упоминаний в коде), отдельного домена и переменных окружения для API-URL во фронте. В коде нет следов такой схемы.
- **Containers + nginx reverse-proxy** — нет `Dockerfile`, нет `nginx.conf`, нет k8s-манифестов.
- **npm workspaces** — корневой `package.json` не содержит `workspaces`; зависимости явно ставятся через `npm install --prefix frontend`.

Удалённых deps или закомментированных альтернатив, подтверждающих другие попытки, не видно — на уровне «что ещё рассматривали» **LOW**.

## Consequences

**+**
- Один process, один origin → нет CORS, нет cookies cross-site, нет лишних токенов в URL'ах.
- Дешевле в эксплуатации (одна Heroku-dyno).
- В dev фронт ничего не знает про абсолютный API-URL — переезд между средами проще.

**−**
- SPA-fallback `app.get('*', ...)` ловит всё после API-роутов: любой новый `/api/*`-роут, добавленный **после** этого блока, будет отдавать HTML вместо JSON (это уже отмечено в `CLAUDE.md`).
- Нет CDN — статика отдаётся Node-процессом, ETag/Cache-Control руками не настроены.
- `uploads/` лежит на ephemeral-FS Heroku — при рестарте дайно картинки пропадают; для реального деплоя нужен S3/Cloudinary, в коде этого нет.
- Прокси через `127.0.0.1` (а не `localhost`) — на Windows `localhost` иногда резолвится в `::1`, и прокси молча ломается; это уже зафиксировано как gotcha.
