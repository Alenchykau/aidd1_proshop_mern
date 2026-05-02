# ProShop — MERN eCommerce

Учебный eCommerce-магазин на MERN: каталог товаров с поиском/пагинацией/рейтингами, корзина, checkout через PayPal sandbox, заказы, пользовательские профили и админка (CRUD товаров, пользователей, отметка заказов доставленными). Изначально — проект курса Брэда Треверси; здесь поддерживается в учебных целях.

> ⚠️ Upstream-проект (Brad Traversy) помечен как deprecated. Эта копия используется для учебной работы и поддерживается локально.

## Features (что реально работает)

- Каталог с поиском по ключевому слову и пагинацией
- Карусель топ-товаров, рейтинги и отзывы (review per user)
- Корзина в `localStorage` (переживает reload)
- Checkout: shipping → payment method → placeOrder → PayPal sandbox
- JWT-auth (HS256, 30 дней), bcrypt-хеши паролей
- Загрузка изображений через `multer` в `uploads/` (JPG/JPEG/PNG)
- Админка: CRUD товаров и пользователей, mark order delivered
- Seeder: `data:import` / `data:destroy`

## Tech Stack

**Backend (ES Modules)**
- Node ≥ 14.6 (Node 17+ — см. [Troubleshooting](#troubleshooting) про OpenSSL)
- Express `4.17.1`
- Mongoose `5.10.6` (не 6+ — ломает `config/db.js`: там опции `useCreateIndex`/`useNewUrlParser`/`useUnifiedTopology`)
- `jsonwebtoken` `8.5.1`, `bcryptjs` `2.4.3`
- `express-async-handler` `1.1.4` (единственный паттерн async-обработки)
- `multer` `1.4.2` — disk storage
- `morgan` `1.10.0` (dev), `dotenv` `8.2.0`, `colors` `1.4.0`
- Dev: `nodemon` `2.0.4`, `concurrently` `5.3.0`

**Frontend (CRA 3.4.3, Webpack 4)**
- React `16.13.1`, React-DOM `16.13.1`
- `react-router-dom` `5.2.0` (API v5: `<Route component={X}>`, не v6)
- Classic Redux `4.0.5` + `react-redux` `7.2.1` + `redux-thunk` `2.3.0` (не RTK)
- `redux-devtools-extension` `2.13.8`
- `axios` `0.20.0`
- `react-bootstrap` `1.3.0`, `react-router-bootstrap` `0.25.0`
- `react-helmet` `6.1.0`, `react-paypal-button-v2` `2.6.2`

## MCP Server: Feature Flags

Папка [`mcp-feature-flags/`](./mcp-feature-flags) содержит MCP-сервер (stdio) для управления флагами в [`project-data/features.json`](./project-data/features.json). Используется ассистентом для чтения и изменения статусов фич без правок в код.

**Стек:** TypeScript + [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) (TS SDK) + [`zod`](https://zod.dev) для валидации входов. Сборка через `tsc` (ESM, target ES2022).

**Tools (3):**
- `get_feature_info(feature_name)` — полные данные фичи + текущий статус каждой зависимости.
- `set_feature_state(feature_name, state)` — `Disabled | Testing | Enabled`. Жёсткий блок: переход в `Enabled` запрещён, если хотя бы одна зависимость в `Disabled` (ошибка `DEPENDENCY_NOT_ENABLED`).
- `adjust_traffic_rollout(feature_name, percentage)` — целое 0–100. Жёсткий lock: `percentage > 0` запрещён при `status="Disabled"` (ошибка `DISABLED_TRAFFIC_LOCKED`).

**Запуск:**
```bash
cd mcp-feature-flags
npm install
npm run build
npm start                # node dist/server.js — слушает MCP по stdio
```

Подключение в `claude_desktop_config.json` / IDE-плагине: указать `command: node`, `args: ["<absolute-path>/mcp-feature-flags/dist/server.js"]`.

## Project Structure

```
proshop/
├─ backend/                    # Express API, ES Modules
│  ├─ config/db.js             # Mongoose connection
│  ├─ controllers/             # productController, userController, orderController
│  ├─ data/                    # Seed data (products.js, users.js)
│  ├─ middleware/              # authMiddleware (protect/admin), errorMiddleware
│  ├─ models/                  # productModel, userModel, orderModel
│  ├─ routes/                  # productRoutes, userRoutes, orderRoutes, uploadRoutes
│  ├─ utils/generateToken.js   # JWT signer (HS256, 30d)
│  ├─ seeder.js                # Import / destroy DB
│  └─ server.js                # Entry point, static /uploads, SPA fallback в prod
├─ frontend/                   # Create React App
│  ├─ public/
│  └─ src/
│     ├─ actions/              # Redux thunks (axios → API)
│     ├─ components/           # Reusable UI (Header, Rating, Paginate, …)
│     ├─ constants/            # Redux action-type strings
│     ├─ reducers/             # One reducer per async op
│     ├─ screens/              # Route-level components
│     ├─ store.js              # combineReducers + thunk + localStorage rehydrate
│     ├─ App.js                # Routing (react-router-dom v5)
│     └─ index.js
├─ mcp-feature-flags/          # MCP server (TS SDK + Zod) — управление features.json
│  ├─ server.ts                # Один файл, 3 tools: get_feature_info / set_feature_state / adjust_traffic_rollout
│  ├─ package.json             # Отдельные deps от MERN-приложения
│  └─ tsconfig.json
├─ project-data/               # Данные для MCP-сервера (features.json и сопутствующая документация)
├─ uploads/                    # Multer target — product images (gitignored в проде)
├─ .env                        # См. ниже (gitignored)
├─ package.json                # Backend deps + scripts
├─ Procfile                    # Heroku entry: `node backend/server.js`
└─ CLAUDE.md                   # Project guide for AI assistants
```

## Prerequisites

- **Node.js** — рекомендую **Node 16 LTS**. Работает и на Node 18/20/22/24, но для Node 17+ нужен флаг `--openssl-legacy-provider` (уже вшит в `frontend/package.json` — см. [Troubleshooting](#node-17-openssl-error)).
- **npm** — идёт с Node. Не используй yarn/pnpm, lock-файл npm-only.
- **MongoDB** — один из:
  - локальный mongod (Windows Service / macOS brew / Linux systemd),
  - Docker: `docker run -d --name proshop-mongo -p 127.0.0.1:27017:27017 -v proshop-mongo-data:/data/db mongo:6`,
  - MongoDB Atlas (free tier подойдёт; учти ограничения сети — см. Troubleshooting).
- **Git** (для клонирования).
- Опционально — **PayPal Developer sandbox account** для рабочего checkout (без него ≈ всё остальное работает, PayPal-кнопка просто не загрузится).

> **Windows-специфика:** путь установки **не должен содержать `&`** — cmd.exe (дефолтный `script-shell` npm на Windows) режет строку по амперсанду, и `npm run dev` падает с загадочным `MODULE_NOT_FOUND`. Переименуй папку, если нужно.

## Environment Variables

Создай **`.env`** в корне репозитория (не в `frontend/`). Читаются в коде:

| Переменная | Где читается | Обязательна? | Пример |
|---|---|---|---|
| `MONGO_URI` | `backend/config/db.js` | ✅ да | `mongodb://127.0.0.1:27017/proshop_mern` |
| `JWT_SECRET` | `backend/utils/generateToken.js`, `backend/middleware/authMiddleware.js` | ✅ да | `abc123` (любая строка ≥12 симв.) |
| `PAYPAL_CLIENT_ID` | `backend/server.js` (endpoint `/api/config/paypal`) | ⚠️ нужна только для PayPal checkout | `AY1...` (sandbox ID с developer.paypal.com) |
| `NODE_ENV` | `backend/server.js`, `errorMiddleware.js` | ✅ да | `development` или `production` |
| `PORT` | `backend/server.js` | ⛔ нет, дефолт `5000` | `5000` |

**Пример `.env`:**
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/proshop_mern
JWT_SECRET=replace_with_long_random_string
PAYPAL_CLIENT_ID=paste_from_paypal_developer_sandbox
```

> **Не используй `localhost` на Windows** — Node может зарезолвить его в IPv6 (`::1`), а mongod по дефолту слушает только IPv4. То же самое касается dev-proxy CRA → backend (уже зафиксировано как `127.0.0.1` в `frontend/package.json`). Всегда явный IPv4.

> `PAYPAL_CLIENT_ID` **не** выставляется как `REACT_APP_*` — frontend получает его в runtime через `/api/config/paypal`.

## Install

Две независимые установки (npm workspaces не используются):

```bash
npm install                       # backend (root)
npm install --prefix frontend     # frontend (CRA)
```

## Run (dev)

```bash
npm run dev
```

Это запустит через `concurrently`:
- API на `:5000` (nodemon, hot reload при изменениях в `backend/`)
- CRA dev-server на `:3000` (HMR). `/api/*` проксируется в `127.0.0.1:5000` (см. `frontend/package.json` → `proxy`).

Ожидаемые строки в логе:
```
[0] Server running in development mode on port 5000
[0] MongoDB Connected: 127.0.0.1
[1] Compiled successfully!     (или с eslint-warnings — ок)
[1] You can now view frontend in the browser.
```

Открой **http://localhost:3000** — должна отобразиться главная со списком товаров.

Другие скрипты (из корня):

| Команда | Что делает |
|---|---|
| `npm run server` | Backend only, с nodemon |
| `npm run client` | Frontend only (CRA dev server) |
| `npm start` | Backend без reload (как на Heroku) |
| `npm run data:import` | Залить дефолтных юзеров и товары в MongoDB |
| `npm run data:destroy` | Дропнуть users/products/orders |
| `npm run build --prefix frontend` | Prod-сборка в `frontend/build` |
| `npm test --prefix frontend` | CRA/Jest тесты |

## Seed database

```bash
npm run data:import
```

Загрузит:
- 3 пользователя (**сохраняй эти логины — админа нет нигде в UI, только в сидах**)
- 6 демо-товаров с локальными картинками (`frontend/public/images/*.jpg`)

**Sample logins** (пароль у всех — `123456`):

| Email | Role |
|---|---|
| `admin@example.com` | Admin |
| `john@example.com` | Customer |
| `jane@example.com` | Customer |

Сброс:
```bash
npm run data:destroy
```

⚠️ `data:destroy` стирает Mongo, но **не `localStorage` браузера**. После ресида логин/корзина в уже открытой вкладке будут ссылаться на удалённые `_id` — очисти Application → Storage или перелогинься.

## Production build & deploy

```bash
npm run build --prefix frontend        # → frontend/build
NODE_ENV=production node backend/server.js
```

В `NODE_ENV=production` Express начинает **отдавать `frontend/build` статикой** и делает SPA-fallback на `index.html`, так что **API и клиент живут на одном порту** — CORS не настроен и не нужен.

На Heroku: `Procfile` запускает `node backend/server.js`; `heroku-postbuild` ставит `NPM_CONFIG_PRODUCTION=false` (чтобы CRA-devDeps установились) и собирает frontend.

⚠️ `uploads/` лежит на локальной ФС — на Heroku это **эфемерный dyno**, загруженные картинки пропадут при рестарте. Для реального продакшена — выноси в S3 или аналог.

---

## Troubleshooting

Типовые грабли, реально пойманные при подъёме проекта с нуля.

### Node 17+: OpenSSL error

```
Error: error:0308010C:digital envelope routines::unsupported
code: 'ERR_OSSL_EVP_UNSUPPORTED'
```

**Причина:** CRA 3.4.3 → webpack 4 → MD4 для хеширования. Node 17+ с OpenSSL 3 убрал MD4 из дефолтного provider'а.

**Фикс уже вшит** в `frontend/package.json`:
```json
"start": "set NODE_OPTIONS=--openssl-legacy-provider&& react-scripts start",
"build": "set NODE_OPTIONS=--openssl-legacy-provider&& react-scripts build",
```

Скрипт Windows-ориентированный (cmd.exe `set`). Если разворачиваешь на macOS/Linux — замени `set X=Y&&` на `cross-env X=Y` (и добавь `cross-env` в devDeps) или на `X=Y` (bash-синтаксис). CLI-флаг ноды (`node --openssl-legacy-provider`) **не работает** — он не наследуется worker-threads webpack'а, только env-переменная.

Альтернатива — поставить Node 16 LTS через `fnm` / `nvm-windows`: проблема исчезнет без правок.

### MongoDB Atlas: DNS ETIMEOUT под VPN

```
Error: querySrv ETIMEOUT _mongodb._tcp.<cluster>.mongodb.net
```

**Причина:** `mongodb+srv://` URI требует SRV-DNS lookup (специфичный тип запроса). Многие VPN-резолверы его режут или таймаутят.

**Фикс** — переключись на **non-SRV URI** (обычные A-записи шардов):

1. В Atlas: Database → **Connect** → **Drivers** → Node.js version **"2.2.11 or earlier"** → скопировать строку.
2. Результат выглядит так:
   ```
   mongodb://<user>:<pass>@<cluster>-shard-00-00.<sub>.mongodb.net:27017,<cluster>-shard-00-01.<sub>.mongodb.net:27017,<cluster>-shard-00-02.<sub>.mongodb.net:27017/<db>?ssl=true&replicaSet=atlas-<id>-shard-0&authSource=admin&retryWrites=true&w=majority
   ```
3. Подставь в `MONGO_URI`.

Если даже non-SRV даёт `Could not connect to any servers` — смотри ниже.

### MongoDB Atlas: TCP :27017 заблокирован (VPN)

```
Could not connect to any servers in your MongoDB Atlas cluster.
```

(с текстом про whitelist — **не всегда именно whitelist**).

Проверь TCP-доступность:
```powershell
Test-NetConnection -ComputerName "<shard>.mongodb.net" -Port 27017 -InformationLevel Quiet
```

Если `False` — VPN режет outbound на нестандартные порты (часто пропускают только 80/443/22/53). Варианты:
- **Split-tunneling в VPN-клиенте** — исключить `*.mongodb.net` / IPs шардов.
- **Локальный MongoDB** (см. Prerequisites) — проще всего для учебного проекта.
- **Выключить VPN** на время работы (если IT-политика позволяет).

Дополнительно в Atlas: **Network Access → IP Access List** — добавить свой VPN-IP (или `0.0.0.0/0` для dev).

### `Something is already running on port 3000` / `EADDRINUSE :::5000`

Зомби-процессы от предыдущих `npm run dev`, которые `Ctrl+C` не убил до конца.

**Windows:**
```powershell
Get-NetTCPConnection -LocalPort 3000,5000 -State Listen -ErrorAction SilentlyContinue `
  | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**macOS/Linux:**
```bash
lsof -ti:3000,5000 | xargs kill -9
```

### `MODULE_NOT_FOUND` + обрезанный путь в сообщении

Проверь путь репозитория на наличие `&` (амперсанд). cmd.exe, который npm использует как script-shell на Windows, интерпретирует `&` как разделитель команд и режет путь. **Переименуй папку.** `.npmrc` с `script-shell=bash` помогает частично, но `&` всплывёт в других инструментах — проще переименовать.

### PayPal button не рендерится

Endpoint `GET /api/config/paypal` возвращает `PAYPAL_CLIENT_ID` из `.env`. Если переменная пустая — PayPal SDK не инициализируется, checkout застревает на экране оплаты.

**Фикс:** [developer.paypal.com](https://developer.paypal.com) → My Apps & Credentials → **Sandbox** → Create App → скопируй **Client ID** (не Secret) в `PAYPAL_CLIENT_ID`.

Для тестовой оплаты: на экране PayPal залогинься тестовым sandbox-buyer'ом (создаётся там же в Dashboard → Sandbox → Accounts).

### CORS ошибки в dev

В dev их быть не должно — CRA проксирует `/api/*` в `127.0.0.1:5000` через поле `"proxy"` в `frontend/package.json`. Если всплыли:
- проверь, что `proxy` — ровно `http://127.0.0.1:5000` (а **не** `localhost`),
- проверь, что API запрос идёт с относительным путём (`axios.get('/api/products')`, без домена),
- перезапусти CRA-dev-server после изменения `proxy` — значение читается только при старте.

В prod CORS не настроен намеренно — API и SPA на одном origin'е (см. [Production build & deploy](#production-build--deploy)).

### `Mongoose` options deprecated warnings

`config/db.js` использует опции Mongoose 5 (`useCreateIndex`, `useNewUrlParser`, `useUnifiedTopology`), которые **удалены в Mongoose 6**. Апгрейд до 6+ сломает коннект — нужно переписать вызов. Оставь Mongoose `^5.10.x`.

### `localStorage` «залип»

Корзина, shipping-адрес и `userInfo` персистятся в `localStorage` (источник правды для UI-состояния между reload). Если поведение странное после ресида — Application → Storage → Clear site data.

---

## License

MIT — © 2020 Traversy Media (upstream). Форк используется в учебных целях.
