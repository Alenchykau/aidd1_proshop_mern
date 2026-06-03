# Fix #2 — SEC-008 / PERF-015: unauthenticated upload + unanchored file-type regex

## 1. Original finding (из synthesis.md)

> **SEC-008 (HIGH, A04 Insecure Design)** `backend/routes/uploadRoutes.js:37` — `POST /api/upload` has neither `protect` nor `admin`; anyone on the internet can POST files. No `multer` `limits.fileSize`; MIME check trusts client-supplied `file.mimetype`. Files are served statically.
> **PERF-015 (HIGH)** `backend/routes/uploadRoutes.js:30` — no `limits.fileSize`; multipart parsing blocks the event loop; the `/jpg|jpeg|png/` regex is unanchored (matches `jpgsomething`).
> **ARCH-008 (C1)** — route conflates infra + handler + response-shaping; out of scope for this small fix (ADR-candidate).

Cross-mate: SEC-008 ↔ PERF-015 — нельзя чинить по отдельности (auth без лимита = perf-обрыв; лимит без auth = открытая загрузка).

## 2. Что изменил (diff)

`backend/routes/uploadRoutes.js`:
```diff
+import { protect, admin } from '../middleware/authMiddleware.js'
 ...
 function checkFileType(file, cb) {
-  const filetypes = /jpg|jpeg|png/
-  const extname = filetypes.test(path.extname(file.originalname).toLowerCase())
-  const mimetype = filetypes.test(file.mimetype)
-  if (extname && mimetype) {
+  const extOk = /\.(jpe?g|png)$/i.test(path.extname(file.originalname))
+  const mimeOk = /^image\/(jpe?g|png)$/i.test(file.mimetype)
+  if (extOk && mimeOk) {
     return cb(null, true)
   } else { cb('Images only!') }
 }
 const upload = multer({
   storage,
+  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
   fileFilter: ...
 })
-router.post('/', upload.single('image'), (req, res) => {
+router.post('/', protect, admin, upload.single('image'), (req, res) => {
```

`frontend/src/screens/ProductEditScreen.js` (необходимая companion-правка — иначе admin-загрузка получит 401):
```diff
+  const userLogin = useSelector((state) => state.userLogin)
+  const { userInfo } = userLogin
 ...
   const config = {
     headers: {
       'Content-Type': 'multipart/form-data',
+      Authorization: `Bearer ${userInfo.token}`,
     },
   }
```

## 3. Почему такой подход (trade-offs)

- **Два отдельных заякоренных regex** вместо одного: extname (`/\.(jpe?g|png)$/i`) и mimetype (`/^image\/(jpe?g|png)$/i`) имеют разную форму — один общий unanchored шаблон и был корнем бага (substring-match). `/i` сохраняет регистронезависимость, поэтому `.JPG` по-прежнему проходит.
- **`fileSize: 2MB, files: 1`** — multer сам отклонит крупные/множественные загрузки до того, как event loop захлебнётся; это и закрывает PERF-015.
- **`protect, admin`** до multer — неаутентифицированный запрос отбивается ещё до парсинга multipart (не тратим I/O на чужой ввод).
- **Фронт-правка** минимальна и следует канону проекта (инлайновый `Bearer`-заголовок из `userLogin.userInfo.token`, CLAUDE.md). Без неё фикс был бы корректен на бэке, но сломал бы UI — поэтому это «явная необходимость», а не расширение scope.
- Storage-абстракция (S3, ARCH-008) и magic-byte sniffing намеренно НЕ трогал — это отдельный архитектурный фикс, выходит за рамки safe-small-refactor.

## 4. Статус тестов

`node --test --experimental-test-module-mocks homework/M6/stage2-fix-top3/tests/fix-2-upload-auth.test.mjs`

```
✔ valid jpg (.jpg + image/jpeg) is accepted
✔ [SEC-008/PERF-015 fixed] anchored regex rejects bogus ".jpgx" extension
✔ non-image (.pdf) is rejected with "Images only!"
✔ [SEC-008 fixed] POST /api/upload is guarded by protect + admin
ℹ tests 4 · pass 4 · fail 0
```

До фикса 4/4 были зелёными (пинили баг: `.jpgx` accepted, роут из 2 хендлеров без auth).

## 5. Behavior change

**Да, намеренное (два изменения):**
- `[PINS ... .jpgx -> accepted]` → `[fixed] .jpgx -> rejected ('Images only!')`. Заякоренный regex осознанно отвергает поддельные расширения.
- `[PINS ... no protect/admin, 2 handlers]` → `[fixed] guarded by protect+admin, 4 handlers`. Роут стал admin-only.
- Не-целевые (valid jpg accepted, .pdf rejected) — зелёные до и после.
- Контракт ответа (`/${req.file.path}` на успехе) не изменён. Примечание: `protect` обёрнут `express-async-handler`, поэтому в route-stack его `.name` = `asyncUtilWrap` (тест это учитывает).

## 6. Выводы

AI верно связало SEC-008+PERF-015 в один фикс. Чего ревью **не** заметило: бэкенд-фикс в одиночку ломает рабочий UI (фронт грузил без токена) — это поймал бы только E2E/integration-тест, не unit на контроллере. Урок: security-hardening эндпоинта почти всегда тянет companion-правку на стороне вызывающего клиента.
