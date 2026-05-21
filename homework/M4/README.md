# M4 — Redesign

## Какие инструменты использовали

- **Claude Code** (Anthropic CLI, Opus 4.7) — основная IDE.
- **Superpowers skill suite:**
  - `superpowers:brainstorming` — обсуждение и согласование дизайна перед каждой фазой (Phase 0–3), один вопрос за раз с multiple-choice вариантами.
  - `superpowers:writing-plans` — генерация bite-sized implementation plans с verbatim кодом для каждой задачи.
  - `superpowers:subagent-driven-development` — исполнение планов через диспетчирование fresh sub-agent на каждую задачу + двухстадийный ревью (spec compliance → code quality).
- **`@frontend-developer` agent prompt** (`.claude/agents/frontend-developer/SKILL.md`) — использован как reference: оттуда взяты паттерны атомарного дизайна, ARIA wiring, мобильный-first responsive, performance/accessibility checklists. Сам агент не диспетчировался — служил как методологическая база.
- **UX wireframe-first методология** — отражена в `DESIGN.md` §11 anti-slop guards ("ASCII wireframe first"). 8 групповых ASCII-wireframes (HomeProductGrid, ProductDetails, Cart, AuthFormCard, CheckoutStep, OrderSummary, AdminListTable, AdminEditForm) задокументированы в Phase 0 spec до написания кода.

## Подход к дизайну

Дизайн-система: **ProShop Tech-Minimal Dark** (см. `DESIGN.md`). Семантические CSS-токены на `:root` (light) и `.dark` (dark), функциональный переключатель тем в Header, OS preference как fallback. Bootstrap 4 переведён на токены через `bootstrap-overrides.css`, поэтому легаси-экраны меняют тему вместе с редизайн-экранами.

Стратегия — **гибрид:** сначала общие atoms (`Card`, `Button`, `FormField`, `FormCard`, `DataTable`, `Pagination`, `Badge`, `ThemeToggle`), потом per-screen редизайн в порядке public → auth → admin. Восемь групповых ASCII-wireframes в Phase 0 spec покрывают все 16 экранов как шаблоны.

Phase split:
- **Phase 0 — Foundation:** токены, theme toggle, bootstrap-overrides, 8 ui/ atoms, wireframes (19 коммитов)
- **Phase 1 — Public:** Home / Product / Cart + Product/ProductCarousel/Paginate/Rating/Loader/Message refactors (12 коммитов)
- **Phase 2 — Auth/Checkout:** Login / Register / Profile / Shipping / Payment / PlaceOrder / Order + CheckoutSteps rewrite (12 коммитов)
- **Phase 3 — Admin:** UserList / UserEdit / ProductList / ProductEdit / OrderList + FormCard `width='md'` + удаление FormContainer (10 коммитов)

## Component decisions

### Reused as-is (готовое из стека)

- **React 16.13 + react-router-dom v5 + classic Redux 4 + redux-thunk** — project-pinned stack, без миграций (см. `CLAUDE.md` "Tech Stack — Explicitly NOT used").
- **react-bootstrap 1.3** — оставлены `Carousel` (внутри редизайнутого `ProductCarousel`), `Spinner` (внутри `Loader` с token-CSS), `Alert` (внутри `Message` с token-CSS), `Navbar` структура (restyled через `.app-navbar`). `Form.Check` радио в `PaymentScreen` заменён на raw `<input type='radio'>` для полного контроля стилей.
- **bootstrap.min.css** (локальный Bootswatch Lux) — оставлен как структурный baseline; visible component classes переопределены через `bootstrap-overrides.css` на наши токены. Удалены только legacy `.carousel*` правила в `index.css` (конфликтовали с новым carousel).
- **FontAwesome 5.14 (CDN)** — все иконки через `<i className='fas fa-...'>` (трэш, плюс, edit, sun/moon, и т.д.). Не добавляли `react-icons` — лишняя зависимость.
- **Manrope + DM Mono** (Google Fonts) — display/body и mono для цен/ID. Соответствует DESIGN.md §2 ("не Inter").
- **react-paypal-button-v2** — оставлен в `OrderScreen` как third-party PayPal SDK wrapper. Только окружающая Card стилизована.
- **EmptyState** (от M3 feature dashboard) — расширен `cta` prop'ом для Cart/ProductList. Базовая разметка как была.

### Custom (построено с нуля)

- **8 ui/ atoms** под `frontend/src/components/ui/`:
  - `Card` — токен-обёртка с `as` polymorphism (`as={Link}` делает всю карточку кликабельной без вложенных anchor'ов)
  - `Button` — 5 вариантов (primary/secondary/danger/ghost/icon) + `loading` state с inline spinner + ARIA busy
  - `Badge` — 4 варианта (default/primary/danger/info), mono UPPERCASE, `color-mix` тинты
  - `FormField` — `<label>` + `<input>` + helper/error с полным ARIA wiring (`aria-required`, `aria-invalid`, `aria-describedby`)
  - `FormCard` — центрированная Card обёртка для auth-style screens, `width='sm'|'md'` (480px/560px)
  - `DataTable` — wrapper над `<table>` со skeleton-loading рядами и emptyState slot, поддержка `mono`/`align`/`render` колонок
  - `Pagination` — token-driven page-row с current = primary
  - `ThemeToggle` — IconButton sun/moon, переключает между light/dark
- **`ThemeContext`** (`frontend/src/context/ThemeContext.js`) — управляет `'light'|'dark'|'system'`, persists в `localStorage['proshop-theme']`, подписывается на `matchMedia` только в `'system'` режиме, синхронизирует `<html data-theme + .dark class>`.
- **Anti-FOUC inline script** в `frontend/public/index.html` — синхронно применяет тему на `<html>` ДО загрузки React-бандла, нет вспышки противоположной темы при reload.
- **`bootstrap-overrides.css`** — pure CSS (не SCSS, чтобы не добавлять `node-sass` зависимость), переопределяет visible Bootstrap component classes (`.btn-primary`, `.card`, `.form-control`, `.navbar-*`, `.table`, `.pagination`, и т.д.) на наши токены. `!important` только на navbar background для победы над Bootswatch специфичностью.
- **`CheckoutSteps` stepper** — полная переписка с Bootstrap `<Nav>` на custom `<ol>` с numbered circles + connecting lines. State derivation через `Array.lastIndexOf(true)`. Активный/завершённый/pending визуальные состояния, `aria-current='step'` на активной ссылке.
- **Per-screen layout CSS** для всех 16 экранов:
  - public: `HomeScreen.css` (hero + grid spacing), `ProductScreen.css` (3-col grid с sticky sidebar), `CartScreen.css` (2-col grid с sticky summary)
  - auth: `auth-form.css` (shared footer link), `ProfileScreen.css` (single-column), `PaymentScreen.css` (radio styling), `PlaceOrderScreen.css` + `OrderScreen.css` (OrderSummary template — duplicated по design decision)
  - admin: `admin-page.css` (shared layout/header/checkbox/file-upload patterns)
- **Все 16 экранов и 5 поддерживающих компонентов** (Product, ProductCarousel, Paginate, Rating, Loader, Message) — переписаны: убраны `Row`/`Col`/`ListGroup`/`Card`/`Button`/`Form` из react-bootstrap в редизайн-файлах (где это имело смысл). Используются CSS Grid для layout, ui/ atoms для контролов, FontAwesome для иконок.
- **Удалён `FormContainer.js`** — был mid-стек обёрткой над Bootstrap Container/Row/Col, заменён на `FormCard` атом во всех 6 consumer'ах.

## Прогресс sitemap.md (16/16 ✓)

| #  | Page                       | Route                              | File                       | Видимость | Сделал?           |
|----|----------------------------|------------------------------------|----------------------------|-----------|-------------------|
| 1  | Home / Search results      | /, /search/:keyword, /page/:n      | HomeScreen.js              | public    | [x]               |
| 2  | Product details            | /product/:id                       | ProductScreen.js           | public    | [x]               |
| 3  | Cart                       | /cart/:id?                         | CartScreen.js              | public    | [x]               |
| 4  | Login                      | /login                             | LoginScreen.js             | public    | [x]               |
| 5  | Register                   | /register                          | RegisterScreen.js          | public    | [x]               |
| 6  | Profile                    | /profile                           | ProfileScreen.js           | auth      | [x]               |
| 7  | Shipping                   | /shipping                          | ShippingScreen.js          | auth      | [x]               |
| 8  | Payment                    | /payment                           | PaymentScreen.js           | auth      | [x]               |
| 9  | Place Order                | /placeorder                        | PlaceOrderScreen.js        | auth      | [x]               |
| 10 | Order details              | /order/:id                         | OrderScreen.js             | auth      | [x]               |
| 11 | Admin: Users list          | /admin/userlist                    | UserListScreen.js          | admin     | [x]               |
| 12 | Admin: User edit           | /admin/user/:id/edit               | UserEditScreen.js          | admin     | [x]               |
| 13 | Admin: Products list       | /admin/productlist                 | ProductListScreen.js       | admin     | [x]               |
| 14 | Admin: Product edit        | /admin/product/:id/edit            | ProductEditScreen.js       | admin     | [x]               |
| 15 | Admin: Orders list         | /admin/orderlist                   | OrderListScreen.js         | admin     | [x]               |
| 16 | Admin: Feature Dashboard   | /admin/featuredashboard            | FeatureDashboardScreen.js  | admin     | [x] обязательно   |

## Связанные документы

- `DESIGN.md` — единый источник истины по визуальным решениям (токены, типографика, отступы, состояния, anti-slop guards)
- `sitemap.md` — список всех страниц для редизайна
- `docs/superpowers/specs/2026-05-10-m4-foundation-design.md` — Phase 0 design spec
- `docs/superpowers/plans/2026-05-10-m4-foundation.md` — Phase 0 implementation plan
- `docs/superpowers/specs/2026-05-10-m4-phase1-public-design.md` — Phase 1 spec
- `docs/superpowers/plans/2026-05-10-m4-phase1-public.md` — Phase 1 plan
- `docs/superpowers/specs/2026-05-10-m4-phase2-auth-checkout-design.md` — Phase 2 spec
- `docs/superpowers/plans/2026-05-10-m4-phase2-auth-checkout.md` — Phase 2 plan
- `docs/superpowers/specs/2026-05-10-m4-phase3-admin-design.md` — Phase 3 spec
- `docs/superpowers/plans/2026-05-10-m4-phase3-admin.md` — Phase 3 plan
