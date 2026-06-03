# Fix #3 — SEC-004 / PERF-001: user-controlled `$regex` in `getProducts`

## 1. Original finding (из synthesis.md)

> **SEC-004 (MEDIUM, A03 Injection)** `backend/controllers/productController.js:14` — `req.query.keyword` passed as-is into a `$regex` query with no escaping and no length cap. Attackers can send catastrophic-backtracking patterns (ReDoS) and use metacharacters (`^`, `$`, `.*`) to bypass intended filtering.
> **PERF-001 (HIGH)** `productController.js:14` — same line: unanchored case-insensitive regex → COLLSCAN over every product; ~500ms-2s @100k products + ReDoS CPU spike.

Cross-mate: **флагнули security-mate и performance-mate одновременно** — один фикс закрывает обе категории (no injection + no ReDoS + cheaper scan).

## 2. Что изменил (diff)

```diff
-  const keyword = req.query.keyword
+  // Cap raw input length first (bounds ReDoS), THEN escape regex
+  // metacharacters so the keyword is matched literally, not as a pattern.
+  const rawKeyword = req.query.keyword
+    ? String(req.query.keyword).slice(0, 64)
+    : ''
+  const keyword = rawKeyword
     ? {
         name: {
-          $regex: req.query.keyword,
+          $regex: rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
           $options: 'i',
         },
       }
     : {}
```

Файл: `backend/controllers/productController.js` (`getProducts`). Без новых зависимостей — escape сделан вручную.

## 3. Почему такой подход (trade-offs)

- **slice(0,64) ДО escape, не после.** Если резать после экранирования, можно отрезать на середине пары `\x` и получить висячий backslash → невалидный regex. Поэтому кап на сырой ввод, затем escape (экранированный результат ≤128 символов — ограничен).
- **Ручной `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`** вместо пакета `escape-string-regexp` — Stage 2 запрещает новые зависимости, а это стандартный набор regex-метасимволов (одна строка).
- **`String(req.query.keyword)`** — defensive: `req.query` может прийти массивом (`?keyword=a&keyword=b`); приведение к строке убирает `.slice is not a function`.
- Не перешёл на Mongo `$text`-индекс (это рекомендация ревью на будущее, PERF-017) — индекс меняет семантику поиска (whole-word, стемминг) и требует миграции схемы; вне рамок safe-small-refactor. Текущий фикс снимает именно injection + ReDoS + length, сохраняя substring-семантику поиска.

## 4. Статус тестов

`node --test --experimental-test-module-mocks homework/M6/stage2-fix-top3/tests/fix-3-product-regex.test.mjs`

```
✔ no keyword -> empty filter {} and pagination (page 1, pages=ceil(25/10)=3)
✔ plain keyword "phone" -> case-insensitive $regex on name
✔ [SEC-004 fixed] regex metacharacters are escaped before $regex
✔ [PERF-001 fixed] long keyword is capped at 64 chars
✔ pageNumber=2 -> page 2 echoed in body
ℹ tests 5 · pass 5 · fail 0
```

До фикса 5/5 были зелёными (целевые пинили: `.*` сырой, 200-символьный keyword без капа).

## 5. Behavior change

**Да, намеренное (два):**
- `[PINS ".*" RAW]` → `[fixed] ".*" escaped to "\.\*"` — метасимволы теперь матчатся буквально.
- `[PINS 200-char uncapped]` → `[fixed] capped at 64`.
- Не-целевые (empty `{}`, `"phone"` → `$regex:"phone"`, пагинация) — зелёные до и после: экранирование слова без спецсимволов = то же слово, поэтому контракт обычного поиска НЕ изменился.
- Публичный API (`{ products, page, pages }`) не тронут.

## 6. Выводы

Самый «дешёвый» из трёх фиксов с двойной отдачей (security+perf) — ровно та находка, что подсветили два разных агента. Нюанс, который AI в рекомендации не выделило: **порядок** slice→escape критичен (обратный порядок ломает regex на длинном вводе со спецсимволом в позиции 64). Характеризационный тест на длину поймал бы регрессию, но не «висячий backslash» — это стоит держать в голове руками.
