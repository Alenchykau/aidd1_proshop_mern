# M4 Phase 3 — Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign 5 admin screens (UserList, UserEdit, ProductList, ProductEdit, OrderList) to use design tokens, Phase 0 atoms, and the AdminListTable / AdminEditForm wireframes (Phase 0 spec §5.7–§5.8). Extend `FormCard` with a `width='sm'|'md'` prop. Delete the now-unused `FormContainer.js`. Tick off rows #11–#15 in `report.md` to close M4.

**Architecture:** All 3 *List screens use the `DataTable` atom with token-styled column renderers (mono ID, Badge for booleans, ghost-icon row actions). Both *Edit screens use `FormCard width='md'` (560px) instead of FormContainer's md=6 grid column. Delete confirms keep `window.confirm` (no custom Modal atom). A new shared `admin-page.css` holds the page wrapper / header row / checkbox / file-upload styles for the 5 screens.

**Tech Stack:** React 16.13 + classic Redux + react-bootstrap 1.3 (kept for Carousel/Spinner/Alert only — not used by admin screens after this phase). Phase 0 atoms + design tokens. FontAwesome icons via existing CDN.

**Spec:** `docs/superpowers/specs/2026-05-10-m4-phase3-admin-design.md`

**Notes for the engineer:**
- Project pins React 16.13 / react-router v5 / classic Redux. Do not migrate.
- All components are JS, no TypeScript. No tests required for Phase 3.
- Commit format from `CLAUDE.md`: `course: <type>: <summary>`. Do NOT add `Co-Authored-By:` trailer.
- Order matters: FormCard extension (Task 1) and admin-page.css (Task 2) before any screen; UserEdit/ProductEdit (Tasks 4, 6) before FormContainer deletion (Task 8).

---

## File map

**New files**
- `frontend/src/screens/admin-page.css`

**Modified files**
- `frontend/src/components/ui/FormCard.js` — add `width` prop
- `frontend/src/components/ui/FormCard.css` — add `.ui-form-card--md`
- `frontend/src/screens/UserListScreen.js`
- `frontend/src/screens/UserEditScreen.js`
- `frontend/src/screens/ProductListScreen.js`
- `frontend/src/screens/ProductEditScreen.js`
- `frontend/src/screens/OrderListScreen.js`
- `report.md`

**Deleted files**
- `frontend/src/components/FormContainer.js`

---

## Task 1: Extend `FormCard` with `width` prop

**Files:**
- Modify: `frontend/src/components/ui/FormCard.js`
- Modify: `frontend/src/components/ui/FormCard.css`

The atom currently has a fixed 480px max-width. Phase 3 adds an opt-in 560px variant for admin edit forms (more fields). Default `width='sm'` preserves all Phase 2 callers verbatim.

- [ ] **Step 1: Replace `FormCard.js`** (verbatim)

```js
import React from 'react'
import Card from './Card'
import './FormCard.css'

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

export default FormCard
```

- [ ] **Step 2: Append `.ui-form-card--md` to `FormCard.css`**

Open `frontend/src/components/ui/FormCard.css` and append at the end (after the existing `@media (max-width: 640px)` rule):

```css

.ui-form-card--md { max-width: 560px; }
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/ui/FormCard.js frontend/src/components/ui/FormCard.css
git commit -m "course: feat: add width=sm|md prop to FormCard atom"
```

---

## Task 2: Create `admin-page.css`

**Files:**
- Create: `frontend/src/screens/admin-page.css`

Shared by all 5 admin screens. Contains page wrapper, page title, header row layout (for `[H1] [+ Create]`), checkbox styling, file-upload styling, and image preview thumbnail.

- [ ] **Step 1: Create the file** (verbatim)

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

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/admin-page.css
git commit -m "course: feat: add shared admin-page styles"
```

---

## Task 3: Refactor `UserListScreen`

**Files:**
- Modify: `frontend/src/screens/UserListScreen.js`

- [ ] **Step 1: Replace `UserListScreen.js`** (verbatim)

```js
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import EmptyState from '../components/EmptyState'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import { listUsers, deleteUser } from '../actions/userActions'
import './admin-page.css'

const UserListScreen = ({ history }) => {
  const dispatch = useDispatch()

  const userList = useSelector((state) => state.userList)
  const { loading, error, users } = userList

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const userDelete = useSelector((state) => state.userDelete)
  const { success: successDelete } = userDelete

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listUsers())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, successDelete, userInfo])

  const deleteHandler = (id) => {
    if (window.confirm('Are you sure')) {
      dispatch(deleteUser(id))
    }
  }

  const columns = [
    { key: 'id',     header: 'ID',    mono: true,
      render: (u) => u._id },
    { key: 'name',   header: 'Name',
      render: (u) => u.name },
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
                className='ui-btn ui-btn--icon ui-btn--ghost'
                aria-label={`Edit ${u.name}`}>
            <i className='fas fa-edit' aria-hidden='true' />
          </Link>
          <button type='button'
                  className='ui-btn ui-btn--icon ui-btn--ghost'
                  onClick={() => deleteHandler(u._id)}
                  aria-label={`Delete ${u.name}`}>
            <i className='fas fa-trash' aria-hidden='true' />
          </button>
        </>
      ) },
  ]

  return (
    <div className='admin-page'>
      <h1 className='admin-page__title'>Users</h1>
      {error && <Message variant='danger'>{error}</Message>}
      <DataTable
        columns={columns}
        rows={users || []}
        rowKey='_id'
        loading={loading}
        emptyState={<EmptyState heading='No users yet' />}
      />
    </div>
  )
}

export default UserListScreen
```

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/UserListScreen.js
git commit -m "course: feat: redesign UserListScreen with DataTable and Badges"
```

---

## Task 4: Refactor `UserEditScreen`

**Files:**
- Modify: `frontend/src/screens/UserEditScreen.js`

This task removes the `FormContainer` import. Combined with Task 6 (ProductEdit), this drops the last two consumers of FormContainer, enabling Task 8 (deletion).

- [ ] **Step 1: Replace `UserEditScreen.js`** (verbatim)

```js
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import { getUserDetails, updateUser } from '../actions/userActions'
import { USER_UPDATE_RESET } from '../constants/userConstants'
import './admin-page.css'

const UserEditScreen = ({ match, history }) => {
  const userId = match.params.id

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const dispatch = useDispatch()

  const userDetails = useSelector((state) => state.userDetails)
  const { loading, error, user } = userDetails

  const userUpdate = useSelector((state) => state.userUpdate)
  const {
    loading: loadingUpdate,
    error: errorUpdate,
    success: successUpdate,
  } = userUpdate

  useEffect(() => {
    if (successUpdate) {
      dispatch({ type: USER_UPDATE_RESET })
      history.push('/admin/userlist')
    } else {
      if (!user.name || user._id !== userId) {
        dispatch(getUserDetails(userId))
      } else {
        setName(user.name)
        setEmail(user.email)
        setIsAdmin(user.isAdmin)
      }
    }
  }, [dispatch, history, userId, user, successUpdate])

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(updateUser({ _id: userId, name, email, isAdmin }))
  }

  return (
    <>
      <Link to='/admin/userlist'
            className='ui-btn ui-btn--secondary ui-btn--sm admin-page__back'>
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
            <FormField
              id='name'
              label='Name'
              type='text'
              placeholder='Enter name'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormField
              id='email'
              label='Email Address'
              type='email'
              placeholder='Enter email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className='admin-form__checkbox'>
              <input
                type='checkbox'
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              Is Admin
            </label>
            <Button type='submit' variant='primary' loading={loadingUpdate}>
              Update
            </Button>
          </form>
        )}
      </FormCard>
    </>
  )
}

export default UserEditScreen
```

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/UserEditScreen.js
git commit -m "course: feat: redesign UserEditScreen with FormCard and styled checkbox"
```

---

## Task 5: Refactor `ProductListScreen`

**Files:**
- Modify: `frontend/src/screens/ProductListScreen.js`

- [ ] **Step 1: Replace `ProductListScreen.js`** (verbatim)

```js
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import Paginate from '../components/Paginate'
import DataTable from '../components/ui/DataTable'
import Button from '../components/ui/Button'
import {
  listProducts,
  deleteProduct,
  createProduct,
} from '../actions/productActions'
import { PRODUCT_CREATE_RESET } from '../constants/productConstants'
import './admin-page.css'

const ProductListScreen = ({ history, match }) => {
  const pageNumber = match.params.pageNumber || 1

  const dispatch = useDispatch()

  const productList = useSelector((state) => state.productList)
  const { loading, error, products, page, pages } = productList

  const productDelete = useSelector((state) => state.productDelete)
  const {
    loading: loadingDelete,
    error: errorDelete,
    success: successDelete,
  } = productDelete

  const productCreate = useSelector((state) => state.productCreate)
  const {
    loading: loadingCreate,
    error: errorCreate,
    success: successCreate,
    product: createdProduct,
  } = productCreate

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  useEffect(() => {
    dispatch({ type: PRODUCT_CREATE_RESET })

    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
    }

    if (successCreate) {
      history.push(`/admin/product/${createdProduct._id}/edit`)
    } else {
      dispatch(listProducts('', pageNumber))
    }
  }, [
    dispatch,
    history,
    userInfo,
    successDelete,
    successCreate,
    createdProduct,
    pageNumber,
  ])

  const deleteHandler = (id) => {
    if (window.confirm('Are you sure')) {
      dispatch(deleteProduct(id))
    }
  }

  const createProductHandler = () => {
    dispatch(createProduct())
  }

  const columns = [
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
                className='ui-btn ui-btn--icon ui-btn--ghost'
                aria-label={`Edit ${p.name}`}>
            <i className='fas fa-edit' aria-hidden='true' />
          </Link>
          <button type='button'
                  className='ui-btn ui-btn--icon ui-btn--ghost'
                  onClick={() => deleteHandler(p._id)}
                  aria-label={`Delete ${p.name}`}>
            <i className='fas fa-trash' aria-hidden='true' />
          </button>
        </>
      ) },
  ]

  return (
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
        columns={columns}
        rows={products || []}
        rowKey='_id'
        loading={loading}
        emptyState={
          <EmptyState
            heading='No products yet'
            subtitle='Create your first product'
            cta={
              <button type='button'
                      className='ui-btn ui-btn--primary'
                      onClick={createProductHandler}>
                Create Product
              </button>
            }
          />
        }
      />

      <Paginate pages={pages} page={page} isAdmin />
    </div>
  )
}

export default ProductListScreen
```

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/ProductListScreen.js
git commit -m "course: feat: redesign ProductListScreen with DataTable and Create CTA"
```

---

## Task 6: Refactor `ProductEditScreen`

**Files:**
- Modify: `frontend/src/screens/ProductEditScreen.js`

Drops the `FormContainer` import (the second of two; combined with Task 4 enables Task 8).

- [ ] **Step 1: Replace `ProductEditScreen.js`** (verbatim)

```js
import axios from 'axios'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import { listProductDetails, updateProduct } from '../actions/productActions'
import { PRODUCT_UPDATE_RESET } from '../constants/productConstants'
import './admin-page.css'

const ProductEditScreen = ({ match, history }) => {
  const productId = match.params.id

  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [image, setImage] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [countInStock, setCountInStock] = useState(0)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)

  const dispatch = useDispatch()

  const productDetails = useSelector((state) => state.productDetails)
  const { loading, error, product } = productDetails

  const productUpdate = useSelector((state) => state.productUpdate)
  const {
    loading: loadingUpdate,
    error: errorUpdate,
    success: successUpdate,
  } = productUpdate

  useEffect(() => {
    if (successUpdate) {
      dispatch({ type: PRODUCT_UPDATE_RESET })
      history.push('/admin/productlist')
    } else {
      if (!product.name || product._id !== productId) {
        dispatch(listProductDetails(productId))
      } else {
        setName(product.name)
        setPrice(product.price)
        setImage(product.image)
        setBrand(product.brand)
        setCategory(product.category)
        setCountInStock(product.countInStock)
        setDescription(product.description)
      }
    }
  }, [dispatch, history, productId, product, successUpdate])

  const uploadFileHandler = async (e) => {
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('image', file)
    setUploading(true)

    try {
      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
      const { data } = await axios.post('/api/upload', formData, config)
      setImage(data)
      setUploading(false)
    } catch (error) {
      console.error(error)
      setUploading(false)
    }
  }

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(
      updateProduct({
        _id: productId,
        name,
        price,
        image,
        brand,
        category,
        description,
        countInStock,
      })
    )
  }

  return (
    <>
      <Link to='/admin/productlist'
            className='ui-btn ui-btn--secondary ui-btn--sm admin-page__back'>
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
            <FormField
              id='name'
              label='Name'
              type='text'
              placeholder='Enter name'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormField
              id='price'
              label='Price'
              type='number'
              placeholder='Enter price'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            {image && (
              <img
                src={image}
                alt='Product preview'
                className='admin-form__image-preview'
              />
            )}
            <FormField
              id='image'
              label='Image URL'
              type='text'
              placeholder='Enter image url'
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
            <div className='admin-form__upload'>
              <label htmlFor='image-file'
                     className='ui-btn ui-btn--secondary ui-btn--sm'>
                Choose File
              </label>
              <input
                id='image-file'
                type='file'
                accept='image/*'
                onChange={uploadFileHandler}
              />
              {uploading && <Loader />}
            </div>

            <FormField
              id='brand'
              label='Brand'
              type='text'
              placeholder='Enter brand'
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
            <FormField
              id='countInStock'
              label='Count In Stock'
              type='number'
              placeholder='Enter count in stock'
              value={countInStock}
              onChange={(e) => setCountInStock(e.target.value)}
            />
            <FormField
              id='category'
              label='Category'
              type='text'
              placeholder='Enter category'
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <FormField
              id='description'
              label='Description'
              type='text'
              placeholder='Enter description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <Button type='submit' variant='primary' loading={loadingUpdate}>
              Update
            </Button>
          </form>
        )}
      </FormCard>
    </>
  )
}

export default ProductEditScreen
```

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/ProductEditScreen.js
git commit -m "course: feat: redesign ProductEditScreen with FormCard and file upload"
```

---

## Task 7: Refactor `OrderListScreen`

**Files:**
- Modify: `frontend/src/screens/OrderListScreen.js`

- [ ] **Step 1: Replace `OrderListScreen.js`** (verbatim)

```js
import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import EmptyState from '../components/EmptyState'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import { listOrders } from '../actions/orderActions'
import './admin-page.css'

const OrderListScreen = ({ history }) => {
  const dispatch = useDispatch()

  const orderList = useSelector((state) => state.orderList)
  const { loading, error, orders } = orderList

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listOrders())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, userInfo])

  const columns = [
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
        <Link to={`/order/${o._id}`}
              className='ui-btn ui-btn--secondary ui-btn--sm'>
          Details
        </Link>
      ) },
  ]

  return (
    <div className='admin-page'>
      <h1 className='admin-page__title'>Orders</h1>
      {error && <Message variant='danger'>{error}</Message>}
      <DataTable
        columns={columns}
        rows={orders || []}
        rowKey='_id'
        loading={loading}
        emptyState={<EmptyState heading='No orders yet' />}
      />
    </div>
  )
}

export default OrderListScreen
```

- [ ] **Step 2: Commit**

```
git add frontend/src/screens/OrderListScreen.js
git commit -m "course: feat: redesign OrderListScreen with DataTable and Badges"
```

---

## Task 8: Delete `FormContainer.js`

**Files:**
- Delete: `frontend/src/components/FormContainer.js`

By this point, all four Phase 2 callers (Login/Register/Shipping/Payment) and the two Phase 3 callers (UserEdit/ProductEdit) have migrated.

- [ ] **Step 1: Verify no remaining JS consumers**

```
git grep "FormContainer" -- '*.js'
```

Expected: empty output. If any hit, fix that consumer before continuing.

- [ ] **Step 2: Delete the file**

```
git rm frontend/src/components/FormContainer.js
```

- [ ] **Step 3: Commit**

```
git commit -m "course: chore: drop unused FormContainer component"
```

---

## Task 9: Tick rows #11–#15 in `report.md`

**Files:**
- Modify: `report.md`

- [ ] **Step 1: Update the M4 sitemap table**

In `report.md`, find the M4 sitemap table (just below the `## M4 — Redesign` heading). For rows 11 through 15, change the rightmost cell from `[ ]` to `[x]`. Row 16 already shows `[x] обязательно`. Rows 1–10 already show `[x]` from Phase 2.

Use a single `Edit` tool call with `replace_all=false`. The exact target block to replace:

Before:

```
| 11 | Admin: Users list          | /admin/userlist                    | UserListScreen.js          | admin     | [ ]               |
| 12 | Admin: User edit           | /admin/user/:id/edit               | UserEditScreen.js          | admin     | [ ]               |
| 13 | Admin: Products list       | /admin/productlist                 | ProductListScreen.js       | admin     | [ ]               |
| 14 | Admin: Product edit        | /admin/product/:id/edit            | ProductEditScreen.js       | admin     | [ ]               |
| 15 | Admin: Orders list         | /admin/orderlist                   | OrderListScreen.js         | admin     | [ ]               |
```

After:

```
| 11 | Admin: Users list          | /admin/userlist                    | UserListScreen.js          | admin     | [x]               |
| 12 | Admin: User edit           | /admin/user/:id/edit               | UserEditScreen.js          | admin     | [x]               |
| 13 | Admin: Products list       | /admin/productlist                 | ProductListScreen.js       | admin     | [x]               |
| 14 | Admin: Product edit        | /admin/product/:id/edit            | ProductEditScreen.js       | admin     | [x]               |
| 15 | Admin: Orders list         | /admin/orderlist                   | OrderListScreen.js         | admin     | [x]               |
```

- [ ] **Step 2: Commit**

```
git add report.md
git commit -m "course: docs: tick off admin screens in M4 sitemap (M4 complete)"
```

---

## Task 10: Acceptance verification

This task runs spec §7 acceptance criteria. No new code unless a fix is needed.

- [ ] **Step 1: Existing test still passes**

```
npm test --prefix frontend -- --testPathPattern=FeatureListScreen --watchAll=false
```

Expected: PASS (4 tests).

- [ ] **Step 2: Build is clean**

```
npm run build --prefix frontend
```

Expected: "Compiled with warnings". The two pre-existing exhaustive-deps warnings (OrderScreen line 76 area, ProductScreen line 44 area) are still allowed; any NEW warning in admin screens must be fixed.

- [ ] **Step 3: FormContainer fully gone**

```
git grep "FormContainer" -- '*.js'
```

Expected: empty (no JS hits). Markdown spec/plan files may still reference FormContainer in Phase 2 spec text — that's fine.

- [ ] **Step 4: Diff scope check**

```
git diff --stat 55eb46b..HEAD
```

Expected: only files in plan §3 are touched. The deleted `FormContainer.js` shows as a removal.

- [ ] **Step 5: Manual browser smoke**

Open the dev server. Sign in as admin, walk through:

| # | Check | Where |
|---|---|---|
| 1 | Users list | `/admin/userlist` — DataTable with mono ID, name, email-as-mailto, ADMIN/USER Badge, ghost-icon edit/delete; EmptyState if empty |
| 2 | User edit | `/admin/user/:id/edit` — Go Back link, FormCard width=md, 2 FormField + checkbox, Update with loading state |
| 3 | Products list | `/admin/productlist` — header row with H1 + primary "Create Product"; DataTable with mono ID + mono right-aligned price; Paginate; EmptyState w/ CTA |
| 4 | Product edit | `/admin/product/:id/edit` — Go Back, FormCard width=md, 7 FormField, image preview when image set, hidden file input via styled label, uploading Loader |
| 5 | Orders list | `/admin/orderlist` — DataTable with paid/delivered Badges, Details Link |
| 6 | Theme toggle | each of 1-5 — flips correctly |
| 7 | Delete confirm | UserList delete + ProductList delete — `window.confirm` appears |

For any failing check, file a follow-up commit (`course: fix: <what>`).

- [ ] **Step 6: No commit** unless fixes were needed.

---

## Done definition

- All 10 tasks above are checked off.
- All commits land on `m4-redesign`.
- Spec §7 acceptance criteria verified (Task 10).
- No regression in `FeatureListScreen.test.js`.
- `npm run build --prefix frontend` succeeds.
- `report.md` shows all 16 sitemap rows as `[x]`.

When done — M4 complete. Propose to the user:
- Open a single PR for all of M4 (Phases 0+1+2+3) on `m4-redesign`, or
- Wrap up with any final cleanup (memory, screenshots, etc.) before the PR.
