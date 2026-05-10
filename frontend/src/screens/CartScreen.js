import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/EmptyState'
import { addToCart, removeFromCart } from '../actions/cartActions'
import './CartScreen.css'

const CartScreen = ({ match, location, history }) => {
  const productId = match.params.id
  const qty = location.search ? Number(location.search.split('=')[1]) : 1

  const dispatch = useDispatch()

  const cart = useSelector((state) => state.cart)
  const { cartItems } = cart

  useEffect(() => {
    if (productId) {
      dispatch(addToCart(productId, qty))
    }
  }, [dispatch, productId, qty])

  const removeFromCartHandler = (id) => {
    dispatch(removeFromCart(id))
  }

  const checkoutHandler = () => {
    history.push('/login?redirect=shipping')
  }

  const itemCount = cartItems.reduce((acc, item) => acc + item.qty, 0)
  const subtotal = cartItems.reduce((acc, item) => acc + item.qty * item.price, 0)

  if (cartItems.length === 0) {
    return (
      <div style={{ padding: 'var(--space-2xl) 0' }}>
        <EmptyState
          heading='Your cart is empty'
          subtitle='Browse the catalogue to add products'
          cta={<Link to='/' className='ui-btn ui-btn--primary'>Browse Catalogue</Link>}
        />
      </div>
    )
  }

  return (
    <div className='cart-page'>
      <div>
        <h1 className='cart-page__title'>Shopping Cart</h1>
        <div className='cart-list'>
          {cartItems.map((item) => (
            <div className='cart-row' key={item.product}>
              <img src={item.image} alt={item.name} className='cart-row__image' />
              <div className='cart-row__name'>
                <Link to={`/product/${item.product}`}>{item.name}</Link>
              </div>
              <select
                className='cart-row__qty'
                value={item.qty}
                onChange={(e) => dispatch(addToCart(item.product, Number(e.target.value)))}
                aria-label={`Quantity for ${item.name}`}
              >
                {[...Array(item.countInStock).keys()].map((x) => (
                  <option key={x + 1} value={x + 1}>{x + 1}</option>
                ))}
              </select>
              <div className='cart-row__price'>${item.price}</div>
              <button
                type='button'
                className='ui-btn ui-btn--icon ui-btn--ghost cart-row__remove'
                onClick={() => removeFromCartHandler(item.product)}
                aria-label={`Remove ${item.name}`}
              >
                <i className='fas fa-trash' aria-hidden='true' />
              </button>
            </div>
          ))}
        </div>
      </div>

      <Card className='cart-summary'>
        <div className='cart-summary__row'>
          <span>Subtotal ({itemCount} items)</span>
        </div>
        <div className='cart-summary__row'>
          <span>Total</span>
          <span className='cart-summary__total'>${subtotal.toFixed(2)}</span>
        </div>
        <Button
          variant='primary'
          onClick={checkoutHandler}
          className='cart-summary__action'
        >
          Proceed To Checkout
        </Button>
      </Card>
    </div>
  )
}

export default CartScreen
