# Fix #1 — SEC-001: IDOR on `getOrderById`

## 1. Original finding (из synthesis.md / security-review.md)

> **SEC-001 — IDOR: any authenticated user can read any order by id**
> - **File:** `backend/controllers/orderController.js:43`
> - **Severity:** HIGH · **OWASP:** A01 Broken Access Control
> - **Detail:** `getOrderById` fetches `Order` by `req.params.id` and returns it without verifying ownership. Route `/api/orders/:id` is wrapped only by `protect`, so any logged-in customer can enumerate IDs and read other users' shipping addresses, `paymentResult.email_address`, totals.
> - **Fix:** After `Order.findById`, return 403 unless `order.user.toString() === req.user._id.toString() || req.user.isAdmin`.

Кросс-mate: **ARCH-002** (C1) — корень в отсутствии authorization-слоя; этот фикс закрывает точечный случай, ADR-0005 предлагает системное решение.

## 2. Что изменил (diff)

```diff
   if (order) {
+    const ownerId = order.user._id ? order.user._id : order.user
+    if (ownerId.toString() !== req.user._id.toString() && !req.user.isAdmin) {
+      res.status(403)
+      throw new Error('Not authorized to view this order')
+    }
     res.json(order)
   } else {
     res.status(404)
     throw new Error('Order not found')
   }
```

Файл: `backend/controllers/orderController.js` (`getOrderById`). 5 строк добавлено, 0 удалено.

## 3. Почему такой подход (trade-offs)

- Проверка владельца помещена **после** `findById`, чтобы не различать «не существует» (404) и «чужой» (403) ценой лишнего запроса — приемлемо, т.к. перечисление ID всё равно упирается в 403. Альтернатива (зашить `user` в сам запрос `findOne({_id, user})`) ломает admin-доступ и меняет 403→404 семантику.
- `ownerId = order.user._id ? order.user._id : order.user` — устойчиво и к populated-доку (тут `populate('user',...)`), и к сырому ObjectId, без допущений о форме.
- Админ сохраняет доступ (`|| req.user.isAdmin`) — поведение admin-панели не меняется.

## 4. Статус тестов

`node --test --experimental-test-module-mocks homework/M6/stage2-fix-top3/tests/fix-1-order-idor.test.mjs`

```
✔ owner reading own order -> 200 with the order body
✔ [SEC-001 fixed] non-owner reading another user order -> 403, no body
✔ admin reading any order -> 200
✔ missing order -> 404 and Error("Order not found")
ℹ tests 4 · pass 4 · fail 0
```

До фикса те же 4 теста были зелёными (целевой пинил баг: non-owner → 200). После фикса целевой переписан под 403.

## 5. Behavior change

**Да, намеренное изменение поведения** (security-фикс, не рефакторинг).
- Изменён тест `[PINS SEC-001 IDOR] non-owner ... -> 200` → `[SEC-001 fixed] non-owner ... -> 403, no body`. Это правка спеки поведения: старый ответ (200 + чужой заказ) был уязвимостью.
- Не-целевые тесты (owner 200, admin 200, not-found 404) остались зелёными — смежная логика не задета.
- Публичный API не сломан: успешные ответы и форма тела не изменились; добавлен лишь новый 403-путь для несанкционированного доступа.

## 6. Выводы

AI-ревью верно указало корень (нет authz-слоя, ARCH-002): этот же баг живёт в `updateOrderToPaid` (SEC-002) и в SPA-роутах (ARCH-015). Точечный фикс безопасен и мал, но «правильное» решение — общий `authz`-middleware (ADR-0005), иначе следующий `/:id`-эндпоинт снова забудут защитить.
