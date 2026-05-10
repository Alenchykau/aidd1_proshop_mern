# M4 Phase 3 — Admin (UserList / UserEdit / ProductList / ProductEdit / OrderList)

> Status: design
> Owner: frontend
> Created: 2026-05-10
> Branch: `m4-redesign`
> Predecessors: Phase 0 (foundation), Phase 1 (public), Phase 2 (auth/checkout)
> Successors: none — closes M4

---

## 1. Goal

Redesign the five admin screens (sitemap rows #11–#15) to use design tokens,
the Phase 0 atoms, and the AdminListTable / AdminEditForm wireframes from
Phase 0 spec §5.7–§5.8. After Phase 3, all 16 sitemap screens are
redesigned. Phase 3 also deletes the deprecated `FormContainer.js` (deferred
from Phase 2 because UserEdit and ProductEdit still imported it).

In scope:

- `screens/UserListScreen.js`
- `screens/UserEditScreen.js`
- `screens/ProductListScreen.js`
- `screens/ProductEditScreen.js`
- `screens/OrderListScreen.js`
- `components/ui/FormCard.js` — minor extension (`width` prop)
- `components/ui/FormCard.css` — `.ui-form-card--md` variant
- `components/FormContainer.js` — deleted
- `report.md` — tick rows #11–#15

Out of scope:

- Custom Modal atom (delete confirms keep using `window.confirm`)
- Backend, Redux store, action creators, route configuration
- Image-upload logic (`/api/upload` endpoint, multer config) — only the surrounding form control is restyled
- Server-side pagination changes for ProductListScreen
- Image lazy-loading

---

## 2. Decisions (recap from brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Delete confirmation | Keep `window.confirm` | Custom Modal atom not built; YAGNI for one binary prompt; native dialog works in any theme |
| Boolean cells (isAdmin, isPaid, isDelivered) | Render as `Badge` (primary YES / danger NO with optional date) | Already established in ProfileScreen (Phase 2); consistent across the codebase; replaces the green-check / red-X icons |
| FormCard width | Extend atom with `width='sm'\|'md'` prop (sm=480 default, md=560) | AdminEditForm wireframe (§5.8) calls for 560px; auth FormCard stays at 480px; one-time atom extension serves both phases without per-screen CSS overrides |
| Shared admin styles | `frontend/src/screens/admin-page.css` for the 5 screens | Page wrapper / header row / checkbox / file-upload patterns are reused across all admin screens; one shared file beats five copies |
| FormContainer | Delete after UserEdit + ProductEdit migrate | Was deferred in Phase 2; Phase 3 closes it |

---

## 3. Architecture

### 3.1 New files

```
frontend/src/
  screens/
    admin-page.css            # NEW — shared by all 5 admin screens
```

No per-screen `.css` files are created in Phase 3. All admin layout,
typography, checkbox, and file-upload rules live in `admin-page.css`,
imported by each of the 5 screens. If a future screen needs a
screen-specific rule (e.g., a one-off responsive tweak), add a per-screen
`.css` file at that point — Phase 3 doesn't pre-create them.

### 3.2 Modified files

```
frontend/src/
  components/ui/FormCard.js   # MODIFIED — add `width` prop
  components/ui/FormCard.css  # MODIFIED — add `.ui-form-card--md`
  screens/UserListScreen.js
  screens/UserEditScreen.js
  screens/ProductListScreen.js
  screens/ProductEditScreen.js
  screens/OrderListScreen.js
report.md                      # MODIFIED — tick rows #11–#15
```

### 3.3 Deleted files

```
frontend/src/components/FormContainer.js   # DELETED (deferred Phase 2 task)
```

### 3.4 Atom dependencies (Phase 0)

| Consumer | Atoms used |
|---|---|
| UserListScreen | `ui/DataTable`, `ui/Badge`, `EmptyState` |
| UserEditScreen | `ui/FormCard` (width=md), `ui/FormField`, `ui/Button` |
| ProductListScreen | `ui/DataTable`, `ui/Button`, `EmptyState` (+ existing `Paginate`) |
| ProductEditScreen | `ui/FormCard` (width=md), `ui/FormField`, `ui/Button` |
| OrderListScreen | `ui/DataTable`, `ui/Badge`, `EmptyState` |

### 3.5 Five required states per screen

| Screen | Default | Empty | Loading | Error | Success |
|---|---|---|---|---|---|
| UserList | DataTable rows + ghost-icon edit/delete | `EmptyState` "No users yet" | DataTable's built-in skeleton (loading prop) | `Message variant='danger'` above table | n/a (read-only); successful delete refetches via existing useEffect |
| UserEdit | form | n/a | `Loader` for fetch + `<Button loading>` for save | `Message variant='danger'` above form | redirect to `/admin/userlist` |
| ProductList | DataTable + Paginate | `EmptyState` "No products yet" + CTA "Create your first product" | DataTable skeleton; `Loader` for delete/create overlay | `Message variant='danger'` above table | redirect to edit (after create), reload (after delete) |
| ProductEdit | form (incl. file upload + optional thumb preview) | n/a | `Loader` for fetch, image-upload spinner, `<Button loading>` for save | `Message variant='danger'` above form | redirect to `/admin/productlist` |
| OrderList | DataTable rows | `EmptyState` "No orders yet" | DataTable skeleton | `Message variant='danger'` above table | n/a |

---

## 4. Per-screen design

### 4.1 UserListScreen

Markup:

```jsx
<div className='admin-page'>
  <h1 className='admin-page__title'>Users</h1>
  {error && <Message variant='danger'>{error}</Message>}
  <DataTable
    columns={[
      { key: 'id',     header: 'ID',    mono: true, render: (u) => u._id },
      { key: 'name',   header: 'Name' },
      { key: 'email',  header: 'Email',
        render: (u) => <a href={`mailto:${u.email}`}>{u.email}</a> },
      { key: 'admin',  header: 'Admin', align: 'center',
        render: (u) => u.isAdmin
          ? <Badge variant='primary'>ADMIN</Badge>
          : <Badge variant='default'>USER</Badge> },
      { key: 'actions', header: '', align: 'right',
        render: (u) => (
          <>
            <Link to={`/admin/user/${u._id}/edit`}
                  className='ui-btn ui-btn--icon ui-btn--ghost' aria-label={`Edit ${u.name}`}>
              <i className='fas fa-edit' aria-hidden='true' />
            </Link>
            <button type='button'
                    className='ui-btn ui-btn--icon ui-btn--ghost'
                    onClick={() => deleteHandler(u._id)} aria-label={`Delete ${u.name}`}>
              <i className='fas fa-trash' aria-hidden='true' />
            </button>
          </>
        ) },
    ]}
    rows={users || []}
    rowKey='_id'
    loading={loading}
    emptyState={<EmptyState heading='No users yet' />}
  />
</div>
```

Auth/access logic, delete handler, useEffect, redux selectors all preserved
unchanged. The `successDelete` hook still triggers `listUsers()`.

### 4.2 UserEditScreen

Markup:

```jsx
<>
  <Link to='/admin/userlist' className='ui-btn ui-btn--secondary ui-btn--sm admin-page__back'>
    ‹ Go Back
  </Link>
  <FormCard title='Edit User' width='md'>
    {errorUpdate && <Message variant='danger'>{errorUpdate}</Message>}
    {loading ? (
      <Loader />
    ) : error ? (
      <Message variant='danger'>{error}</Message>
    ) : (
      <form onSubmit={submitHandler}>
        <FormField id='name' label='Name' type='text'
                   value={name} onChange={(e) => setName(e.target.value)}
                   placeholder='Enter name' />
        <FormField id='email' label='Email Address' type='email'
                   value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder='Enter email' />
        <label className='admin-form__checkbox'>
          <input type='checkbox' checked={isAdmin}
                 onChange={(e) => setIsAdmin(e.target.checked)} />
          Is Admin
        </label>
        <Button type='submit' variant='primary' loading={loadingUpdate}>
          Update
        </Button>
      </form>
    )}
  </FormCard>
</>
```

`FormContainer` import removed. `Form.Group`/`Form.Control`/`Form.Check`
replaced with `FormField` and a hand-rolled `<label class='admin-form__checkbox'>`.

### 4.3 ProductListScreen

Markup:

```jsx
<div className='admin-page'>
  <div className='admin-page__header'>
    <h1 className='admin-page__title'>Products</h1>
    <Button variant='primary' onClick={createProductHandler}>
      <i className='fas fa-plus' aria-hidden='true' /> Create Product
    </Button>
  </div>

  {loadingDelete && <Loader />}
  {errorDelete && <Message variant='danger'>{errorDelete}</Message>}
  {loadingCreate && <Loader />}
  {errorCreate && <Message variant='danger'>{errorCreate}</Message>}
  {error && <Message variant='danger'>{error}</Message>}

  <DataTable
    columns={[
      { key: '_id',      header: 'ID',       mono: true },
      { key: 'name',     header: 'Name' },
      { key: 'price',    header: 'Price',    mono: true, align: 'right',
        render: (p) => `$${p.price}` },
      { key: 'category', header: 'Category' },
      { key: 'brand',    header: 'Brand' },
      { key: 'actions',  header: '',         align: 'right',
        render: (p) => (
          <>
            <Link to={`/admin/product/${p._id}/edit`}
                  className='ui-btn ui-btn--icon ui-btn--ghost' aria-label={`Edit ${p.name}`}>
              <i className='fas fa-edit' aria-hidden='true' />
            </Link>
            <button type='button'
                    className='ui-btn ui-btn--icon ui-btn--ghost'
                    onClick={() => deleteHandler(p._id)} aria-label={`Delete ${p.name}`}>
              <i className='fas fa-trash' aria-hidden='true' />
            </button>
          </>
        ) },
    ]}
    rows={products || []}
    rowKey='_id'
    loading={loading}
    emptyState={
      <EmptyState
        heading='No products yet'
        subtitle='Create your first product'
        cta={
          <button type='button' className='ui-btn ui-btn--primary'
                  onClick={createProductHandler}>
            Create Product
          </button>
        }
      />
    }
  />
  <Paginate pages={pages} page={page} isAdmin />
</div>
```

### 4.4 ProductEditScreen

Markup (large — 7 fields + image upload):

```jsx
<>
  <Link to='/admin/productlist' className='ui-btn ui-btn--secondary ui-btn--sm admin-page__back'>
    ‹ Go Back
  </Link>
  <FormCard title='Edit Product' width='md'>
    {errorUpdate && <Message variant='danger'>{errorUpdate}</Message>}
    {loading ? (
      <Loader />
    ) : error ? (
      <Message variant='danger'>{error}</Message>
    ) : (
      <form onSubmit={submitHandler}>
        <FormField id='name' label='Name' type='text'
                   value={name} onChange={(e) => setName(e.target.value)}
                   placeholder='Enter name' />
        <FormField id='price' label='Price' type='number'
                   value={price} onChange={(e) => setPrice(e.target.value)}
                   placeholder='Enter price' />

        {image && <img src={image} alt='Product preview'
                       className='admin-form__image-preview' />}
        <FormField id='image' label='Image URL' type='text'
                   value={image} onChange={(e) => setImage(e.target.value)}
                   placeholder='Enter image url' />
        <div className='admin-form__upload'>
          <label htmlFor='image-file' className='ui-btn ui-btn--secondary ui-btn--sm'>
            Choose File
          </label>
          <input id='image-file' type='file' accept='image/*' onChange={uploadFileHandler} />
          {uploading && <Loader />}
        </div>

        <FormField id='brand' label='Brand' type='text'
                   value={brand} onChange={(e) => setBrand(e.target.value)}
                   placeholder='Enter brand' />
        <FormField id='countInStock' label='Count In Stock' type='number'
                   value={countInStock} onChange={(e) => setCountInStock(e.target.value)}
                   placeholder='Enter count in stock' />
        <FormField id='category' label='Category' type='text'
                   value={category} onChange={(e) => setCategory(e.target.value)}
                   placeholder='Enter category' />
        <FormField id='description' label='Description' type='text'
                   value={description} onChange={(e) => setDescription(e.target.value)}
                   placeholder='Enter description' />

        <Button type='submit' variant='primary' loading={loadingUpdate}>
          Update
        </Button>
      </form>
    )}
  </FormCard>
</>
```

Notes:
- Description stays a single-line `<input type='text'>` to match current
  behaviour (FormField only renders `<input>`). A textarea variant would be
  a future enhancement; out of scope.
- File upload `<input>` is hidden by `admin-form__upload input[type='file']
  { display: none }` and triggered by the styled `<label>` (standard a11y
  pattern: clicking the label clicks the input).
- Image preview thumbnail (120x120) sits above the URL input when
  `image` is non-empty.

### 4.5 OrderListScreen

Markup:

```jsx
<div className='admin-page'>
  <h1 className='admin-page__title'>Orders</h1>
  {error && <Message variant='danger'>{error}</Message>}
  <DataTable
    columns={[
      { key: '_id',        header: 'ID',        mono: true },
      { key: 'user',       header: 'User',
        render: (o) => o.user && o.user.name },
      { key: 'createdAt',  header: 'Date',      mono: true,
        render: (o) => o.createdAt.substring(0, 10) },
      { key: 'totalPrice', header: 'Total',     mono: true, align: 'right',
        render: (o) => `$${o.totalPrice}` },
      { key: 'isPaid',     header: 'Paid',      align: 'center',
        render: (o) => o.isPaid
          ? <Badge variant='primary'>{o.paidAt.substring(0, 10)}</Badge>
          : <Badge variant='danger'>NO</Badge> },
      { key: 'isDelivered', header: 'Delivered', align: 'center',
        render: (o) => o.isDelivered
          ? <Badge variant='primary'>{o.deliveredAt.substring(0, 10)}</Badge>
          : <Badge variant='danger'>NO</Badge> },
      { key: 'actions',    header: '',          align: 'right',
        render: (o) => (
          <Link to={`/order/${o._id}`} className='ui-btn ui-btn--secondary ui-btn--sm'>
            Details
          </Link>
        ) },
    ]}
    rows={orders || []}
    rowKey='_id'
    loading={loading}
    emptyState={<EmptyState heading='No orders yet' />}
  />
</div>
```

---

## 5. Atom extension — `FormCard width` prop

`FormCard.js`:

```js
const FormCard = ({ title, width = 'sm', children, className = '', ...rest }) => {
  const widthClass = width === 'md' ? 'ui-form-card--md' : ''
  const cls = `ui-form-card ${widthClass} ${className}`.trim().replace(/\s+/g, ' ')
  return (
    <div className={cls} {...rest}>
      <Card>
        {title && <h1 className='ui-form-card__title'>{title}</h1>}
        {children}
      </Card>
    </div>
  )
}
```

`FormCard.css` adds:

```css
.ui-form-card--md { max-width: 560px; }
```

The default `.ui-form-card { max-width: 480px; }` rule is unchanged. With
no `width` prop (default `'sm'`), no extra class is added — Login, Register,
Profile, Shipping, Payment behaviour preserved.

`width='md'` is consumed only by UserEdit and ProductEdit in Phase 3.

---

## 6. Shared admin styles

`frontend/src/screens/admin-page.css`:

```css
.admin-page { padding: var(--space-md) 0; }

.admin-page__title {
  font-family: 'Manrope', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-md) 0;
  color: var(--foreground);
}

.admin-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
}

.admin-page__header .admin-page__title { margin: 0; }

.admin-page__back {
  display: inline-block;
  margin-bottom: var(--space-md);
}

.admin-form__checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
  cursor: pointer;
  user-select: none;
  color: var(--foreground);
  font-size: 14px;
}

.admin-form__checkbox input {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
  margin: 0;
}

.admin-form__upload {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.admin-form__upload input[type='file'] { display: none; }

.admin-form__image-preview {
  display: block;
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: var(--radius-md);
  background: var(--card-alt);
  border: 1px solid var(--border);
  margin-bottom: var(--space-sm);
}
```

All 5 admin screens import this file. Per-screen `.css` files exist for
future tweaks but may be empty stubs.

---

## 7. Acceptance criteria

Phase 3 is done when ALL of these hold:

1. `/admin/userlist` (admin login required) shows page H1 "Users", DataTable with mono ID, name, email-as-mailto-link, ADMIN/USER Badge, ghost-icon edit/delete; EmptyState when `users.length === 0`; danger Message when `error`; delete still uses `window.confirm`.
2. `/admin/user/:id/edit` shows Go Back secondary button-link, FormCard `width='md'`, three controls (Name FormField, Email FormField, Is Admin styled checkbox), Update Button with loading state. Successful update redirects to `/admin/userlist`.
3. `/admin/productlist` shows page header row with "Products" H1 + primary "Create Product" Button (with FA plus icon), DataTable with mono ID, name, mono right-aligned price, category, brand, ghost-icon edit/delete; Paginate at the bottom; EmptyState with "Create your first product" CTA.
4. `/admin/product/:id/edit` shows Go Back link, FormCard `width='md'`, image preview (120×120) when image URL present, all 7 fields as FormField, hidden file input triggered by styled "Choose File" label, uploading Loader during upload, Update Button with loading state. Successful update redirects to `/admin/productlist`.
5. `/admin/orderlist` shows page H1 "Orders", DataTable with mono ID, user.name, mono date, mono right-aligned total, paid/delivered as Badges (primary with date or danger NO), Details secondary link.
6. `frontend/src/components/FormContainer.js` no longer exists; `git grep "FormContainer" -- '*.js'` returns no hits in the project's JS files.
7. `FormCard` atom accepts `width='sm'|'md'`; default `'sm'` preserves all Phase 2 callers (Login/Register/Profile/Shipping/Payment) at 480px; UserEdit and ProductEdit use `width='md'` (560px).
8. `report.md` rows #11–#15 are marked `[x]`. All 16 sitemap rows now show `[x]` (#16 keeps the "обязательно" suffix).
9. Theme toggle works on all 5 admin screens — DataTable rows, Badge tints, FormCard surface, file-upload label, checkbox accent all flip with the active theme.
10. `npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false` passes (4/4).
11. `npm run build --prefix frontend` exits cleanly. The two pre-existing `react-hooks/exhaustive-deps` warnings in OrderScreen and ProductScreen are still allowed; any NEW warning in admin screens must be fixed.
12. `git diff --stat <phase3-base>..HEAD` touches only the files in §3 (file map) plus `report.md`. No accidental edits to public/auth screens or backend.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `FormCard` `width` prop conflicts with HTML `width` attribute on the wrapper `<div>`. | The prop is destructured from `{...rest}` in the implementation, so it never lands on the DOM as an HTML attribute. |
| Hidden `<input type='file'>` trigger via `<label htmlFor>` may not work on all browsers (rare edge case in IE/old Safari). | The project's browserslist excludes those (last 1 / >0.2%). Pattern is universally supported on current browsers. |
| Image preview (`<img src={image}>`) renders before a valid image URL exists (e.g., during initial load), causing a broken-image icon flash. | Preview is conditionally rendered only when `image` truthy. On initial fetch, `image` is empty until `setImage(product.image)` fires. |
| EmptyState CTA in ProductList re-uses `createProductHandler` — clicking creates a product even if the user reached the empty state by mistake. | Same handler as the header button; behavior is consistent. The `window.confirm` for delete is the safety net, not for create. |
| `FormContainer.js` deletion breaks build if grep missed a consumer. | Pre-flight `git grep "FormContainer" -- '*.js'` runs in Task 8. If any hit, fix that consumer before the deletion commit. |
| ProductListScreen's existing `useEffect` redirect on non-admin user still works after refactor. | Redux selectors and useEffect logic preserved verbatim; only the render output changes. |

---

## 9. Out of scope (explicit non-goals)

- Custom Modal atom for delete confirmations (keep `window.confirm`)
- Bulk actions (delete multiple users at once)
- Sortable / filterable columns in admin DataTables (add when there's a use case)
- Server-side pagination changes
- Image lazy-loading / drag-and-drop upload UX
- Description-as-textarea in ProductEdit (FormField is `<input>` only; out of scope for Phase 3, future enhancement)
- Search/filter row above admin lists (FeatureListScreen has one as the reference; admin lists currently lack search and we don't add it)
- DataTable hover-row "click whole row to edit" affordance

---

## 10. Open questions

None. All brainstorm decisions are recorded in §2; implementation choices inside that scope are spec'd in §4–§6.
