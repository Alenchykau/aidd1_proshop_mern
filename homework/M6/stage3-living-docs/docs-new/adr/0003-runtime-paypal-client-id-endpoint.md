# 3. PayPal client-id served at runtime via `/api/config/paypal`

- Status: Accepted
- Date: implicit (project inception)
- Confidence: **HIGH** (явно в коде: `backend/server.js`, `frontend/src/screens/OrderScreen.js`)

## Context

Фронт рендерит PayPal-кнопку через `react-paypal-button-v2`, которая требует подгрузить SDK с `https://www.paypal.com/sdk/js?client-id=…` до маунта. Нужно было решить, **как** client-id попадёт во фронт:
- собрать в бандл через `REACT_APP_PAYPAL_CLIENT_ID` (CRA-стандарт), или
- отдавать с бэка по запросу.

## Decision

Бэкенд экспонирует публичный эндпоинт прямо из `backend/server.js`:

```js
app.get('/api/config/paypal', (req, res) => res.send(process.env.PAYPAL_CLIENT_ID))
```

Фронт (`frontend/src/screens/OrderScreen.js::useEffect → addPayPalScript`) перед загрузкой SDK делает `axios.get('/api/config/paypal')`, получает строку и подставляет её в `script.src`. CRA-переменная `REACT_APP_PAYPAL_CLIENT_ID` в коде **не используется** — `.env` читается только бэкендом через `dotenv`.

## Alternatives

- **`REACT_APP_PAYPAL_CLIENT_ID` в build-time** — CRA встроил бы значение в JS-бандл; сменить ключ = пересобрать фронт. В коде нет ни одного `process.env.REACT_APP_*` — этот вариант явно отвергнут.
- **Инъекция через index.html на деплое** — `frontend/public/index.html` не содержит шаблонизации/плейсхолдеров.
- **Hardcoded sandbox-id** — нет, вызов идёт за конфигом каждый раз.

Закомментированных следов других попыток в коде нет — альтернативы выводятся из общей практики, не из репо. Уровень **MEDIUM**.

## Consequences

**+**
- Поменять PayPal-аккаунт можно сменой ENV на бэке без пересборки фронта (важно для Heroku, где `heroku-postbuild` пересобирает SPA).
- Один источник правды для всех секретов — корневой `.env`, фронт ничего не знает про `dotenv`.
- Тот же паттерн масштабируется на любой будущий публичный конфиг (Stripe, GA, Sentry DSN…).

**−**
- Лишний round-trip на каждом маунте `OrderScreen` — кэширования нет, ответ — голая строка без `Cache-Control`.
- Эндпоинт публичный по дизайну, но **не помечен** как public — легко перепутать и подложить туда что-то секретное; нет схемы/валидации.
- В `OrderScreen.js` `addPayPalScript` каждый раз делает `document.body.appendChild(script)` без cleanup в `useEffect` → при ре-рендерах копится несколько `<script>`-тегов (это уже отмечено в `FINDINGS.md` #7).
- При недоступности бэка PayPal-кнопка не появится вовсе — fallback'а нет.
