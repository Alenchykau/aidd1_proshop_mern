# 1. JWT in localStorage, sent as Bearer header

- Status: Accepted
- Date: implicit (project inception)
- Confidence: **HIGH** (явно в коде: `backend/middleware/authMiddleware.js`, `backend/utils/generateToken.js`, `frontend/src/actions/userActions.js`, `frontend/src/store.js`)

## Context

API защищена per-route через `protect` middleware. Нужна была схема, где:
- бэкенд stateless (нет таблицы сессий, любой инстанс может валидировать запрос),
- фронт хранит «логин» между перезагрузками вкладки,
- прод раскатывается одним процессом без отдельного auth-сервиса.

## Decision

После логина (`POST /api/users/login`) сервер возвращает `{ _id, name, email, isAdmin, token }`. Токен — `jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' })`, HS256, без refresh-токена (`backend/utils/generateToken.js`).

Фронт кладёт весь `userInfo` (включая токен) в `localStorage` под ключом `userInfo` и зеркалит в Redux `userLogin.userInfo` (`frontend/src/store.js` rehydrates initial state). Все приватные thunks вручную собирают заголовок:

```js
const config = { headers: { Authorization: `Bearer ${userInfo.token}` } }
```

`authMiddleware.protect` читает `req.headers.authorization`, проверяет префикс `Bearer`, верифицирует JWT и подгружает `req.user = await User.findById(decoded.id).select('-password')`.

## Alternatives

- **httpOnly cookie + CSRF-токен** — токен недоступен JS, защищает от XSS-кражи; требует `cookie-parser`, CSRF-middleware и same-site/secure-настроек. Никаких следов попытки в репо нет.
- **Server-side сессии (express-session + connect-mongo)** — нет в зависимостях; противоречит цели stateless API.
- **OAuth/SSO** — внешний IdP; нет ни клиентов, ни конфигов.

В коде нет закомментированных вариантов или удалённых deps, подтверждающих, что что-то из этого реально рассматривалось — отметка по альтернативам **MEDIUM**.

## Consequences

**+**
- Бэкенд полностью stateless — горизонтально масштабируется без sticky-sessions.
- Минимум зависимостей: только `jsonwebtoken` и `bcryptjs`.
- Простая интеграция с любым клиентом (CLI, мобильное), не только браузер.

**−**
- Токен в `localStorage` доступен любому JS на странице → XSS = угон сессии. CSP/sanitize не настроены.
- Нет refresh-токена и нет revocation-листа: украденный токен валиден до 30 дней; logout — это просто `localStorage.removeItem` на клиенте, сервер о нём не знает.
- Каждый thunk вручную клеит `Authorization`-заголовок (нет axios interceptor) → легко забыть на новом эндпоинте.
- `JWT_SECRET` — единственный секрет; ротация ломает все живые сессии.
