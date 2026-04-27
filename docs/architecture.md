# Architecture — proshop_mern

MERN single-page app. React 16 / CRA dev server (port 3000) talks to Express 4 API (port 5000) via the `/api/*` proxy declared in `frontend/package.json`. In production `backend/server.js` runs alone on a single port and serves `frontend/build` as static, so the SPA and the API share an origin.

- **Auth**: JWT HS256, 30-day expiry, `Authorization: Bearer …` headers (`backend/utils/generateToken.js`, `backend/middleware/authMiddleware.js`).
- **State**: classic Redux + `redux-thunk`; `localStorage` is the source of truth for `cartItems`, `userInfo`, `shippingAddress` (`frontend/src/store.js`).
- **Persistence**: MongoDB via Mongoose 5 (`backend/config/db.js`); product images on local filesystem (`uploads/`, ephemeral on Heroku).
- **External**: PayPal Sandbox SDK loaded as `<script>` from `paypal.com/sdk/js`; client-id fetched at runtime from `GET /api/config/paypal`.

## C4 — Container diagram

```mermaid
flowchart LR
  User([User browser])
  Admin([Admin browser])

  subgraph Frontend["Frontend — React 16 / CRA / Redux"]
    direction TB
    FE_Index["frontend/src/index.js"]
    FE_App["frontend/src/App.js<br/>react-router-dom v5"]
    FE_Store["frontend/src/store.js<br/>Redux + thunk"]
    FE_Screens["frontend/src/screens/*Screen.js"]
    FE_Components["frontend/src/components/*"]
    FE_Actions["frontend/src/actions/{cart,order,product,user}Actions.js<br/>axios → /api/*"]
    FE_LS[("localStorage<br/>cartItems, userInfo,<br/>shippingAddress")]
  end

  subgraph Backend["Backend — Express 4 / port 5000"]
    direction TB
    BE_Server["backend/server.js<br/>app.listen + static + SPA fallback"]
    BE_Seed["backend/seeder.js<br/>CLI: npm run data:import / data:destroy"]

    subgraph Routes["routes/"]
      direction TB
      R_Prod["productRoutes.js<br/>/api/products"]
      R_User["userRoutes.js<br/>/api/users"]
      R_Order["orderRoutes.js<br/>/api/orders"]
      R_Up["uploadRoutes.js<br/>/api/upload"]
      R_PP["server.js inline<br/>GET /api/config/paypal"]
    end

    subgraph Middleware["middleware/"]
      M_Auth["authMiddleware.js<br/>protect, admin"]
      M_Err["errorMiddleware.js<br/>notFound, errorHandler"]
    end

    subgraph Controllers["controllers/"]
      direction TB
      C_Prod["productController.js"]
      C_User["userController.js"]
      C_Order["orderController.js"]
    end

    subgraph Models["models/ — Mongoose 5"]
      MD_Prod["productModel.js"]
      MD_User["userModel.js<br/>pre-save bcrypt"]
      MD_Order["orderModel.js"]
    end

    BE_Util["utils/generateToken.js<br/>JWT HS256 30d"]
    BE_DB["config/db.js<br/>mongoose.connect"]
  end

  subgraph DataLayer["Data Layer"]
    Mongo[("MongoDB<br/>process.env.MONGO_URI")]
    FS[("uploads/<br/>local FS<br/>multer disk storage")]
  end

  subgraph External["External Services"]
    PayPal["PayPal Sandbox SDK<br/>paypal.com/sdk/js"]
  end

  User --> FE_Index
  Admin --> FE_Index
  FE_Index --> FE_App
  FE_App --> FE_Screens
  FE_Screens --> FE_Components
  FE_Screens --> FE_Store
  FE_Store <--> FE_LS
  FE_Screens --> FE_Actions

  FE_Actions -.->|"axios JSON /api/*"| BE_Server
  FE_Screens -.->|"script tag"| PayPal

  BE_Server --> Routes
  Routes --> Middleware
  Middleware --> Controllers
  R_Prod --> C_Prod
  R_User --> C_User
  R_Order --> C_Order
  R_PP -->|reads PAYPAL_CLIENT_ID env| FE_Actions
  R_Up -->|multer.single image| FS

  C_Prod --> MD_Prod
  C_User --> MD_User
  C_User --> BE_Util
  C_Order --> MD_Order

  MD_Prod --> Mongo
  MD_User --> Mongo
  MD_Order --> Mongo

  BE_DB --> Mongo
  BE_Seed --> MD_Prod
  BE_Seed --> MD_User
  BE_Seed --> MD_Order

  BE_Server -.->|GET /uploads/*<br/>express.static| FS
  BE_Server -.->|"NODE_ENV=production:<br/>serve frontend/build"| FE_Index
```

## Data flow — «User places an order and pays with PayPal»

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant FE as PlaceOrderScreen.js / OrderScreen.js
  participant ST as Redux store + localStorage
  participant API as Express (server.js)
  participant AUTH as authMiddleware.protect
  participant OC as orderController
  participant OM as orderModel (Mongoose)
  participant DB as MongoDB
  participant PP as PayPal SDK

  U->>FE: Click "Place Order"
  FE->>ST: read cart.cartItems, shippingAddress, paymentMethod
  FE->>API: POST /api/orders<br/>(items + prices computed client-side)
  API->>AUTH: verify Bearer JWT
  AUTH->>API: req.user hydrated
  API->>OC: addOrderItems(req,res)
  OC->>OM: new Order(...).save()
  OM->>DB: insert orders
  DB-->>OM: createdOrder
  OM-->>OC: createdOrder
  OC-->>FE: 201 + order._id

  FE->>API: GET /api/orders/:id  (OrderScreen mount)
  API->>OC: getOrderById
  OC->>DB: Order.findById().populate(user)
  DB-->>OC: order
  OC-->>FE: 200 order JSON

  FE->>API: GET /api/config/paypal
  API-->>FE: PAYPAL_CLIENT_ID
  FE->>PP: load script paypal.com/sdk/js?client-id=…
  PP-->>FE: SDK ready, render PayPalButton
  U->>PP: approve payment in PayPal popup
  PP-->>FE: paymentResult { id, status, update_time, payer.email_address }

  FE->>API: PUT /api/orders/:id/pay (paymentResult)
  API->>AUTH: protect
  API->>OC: updateOrderToPaid
  OC->>OM: set isPaid/paidAt/paymentResult, then save()
  OM->>DB: update order
  DB-->>OC: updatedOrder
  OC-->>FE: 200 updatedOrder
  FE->>U: render "Paid on …"
```

## Entry points cheat sheet

| Kind | Where | Purpose |
|---|---|---|
| HTTP | `backend/server.js` | Composes routes, error middleware, prod static fallback |
| HTTP | `backend/routes/productRoutes.js` | `/api/products`, `/api/products/:id`, `/api/products/top`, reviews |
| HTTP | `backend/routes/userRoutes.js` | `/api/users`, `/api/users/login`, `/api/users/profile`, admin CRUD |
| HTTP | `backend/routes/orderRoutes.js` | `/api/orders`, `/api/orders/:id`, `/pay`, `/deliver`, `/myorders` |
| HTTP | `backend/routes/uploadRoutes.js` | `POST /api/upload` (multer disk → `uploads/`) |
| HTTP inline | `backend/server.js` | `GET /api/config/paypal` returns `PAYPAL_CLIENT_ID` |
| Static | `backend/server.js` | `GET /uploads/*` (image hosting), `*` SPA fallback in prod |
| CLI | `backend/seeder.js` | `npm run data:import` / `npm run data:destroy` |
| SPA | `frontend/src/index.js` → `App.js` | All routes are React Router v5 client-side |
