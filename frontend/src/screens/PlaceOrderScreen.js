import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import CheckoutSteps from '../components/CheckoutSteps'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { createOrder } from '../actions/orderActions'
import { ORDER_CREATE_RESET } from '../constants/orderConstants'
import { USER_DETAILS_RESET } from '../constants/userConstants'
import './PlaceOrderScreen.css'

const PlaceOrderScreen = ({ history }) => {
  const dispatch = useDispatch()

  const cart = useSelector((state) => state.cart)

  if (!cart.shippingAddress.address) {
    history.push('/shipping')
  } else if (!cart.paymentMethod) {
    history.push('/payment')
  }

  const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2)

  cart.itemsPrice = addDecimals(
    cart.cartItems.reduce((acc, item) => acc + item.price * item.qty, 0)
  )
  cart.shippingPrice = addDecimals(cart.itemsPrice > 100 ? 0 : 100)
  cart.taxPrice = addDecimals(Number((0.15 * cart.itemsPrice).toFixed(2)))
  cart.totalPrice = (
    Number(cart.itemsPrice) +
    Number(cart.shippingPrice) +
    Number(cart.taxPrice)
  ).toFixed(2)

  const orderCreate = useSelector((state) => state.orderCreate)
  const { order, success, error } = orderCreate

  useEffect(() => {
    if (success) {
      history.push(`/order/${order._id}`)
      dispatch({ type: USER_DETAILS_RESET })
      dispatch({ type: ORDER_CREATE_RESET })
    }
    // eslint-disable-next-line
  }, [history, success])

  const placeOrderHandler = () => {
    dispatch(
      createOrder({
        orderItems: cart.cartItems,
        shippingAddress: cart.shippingAddress,
        paymentMethod: cart.paymentMethod,
        itemsPrice: cart.itemsPrice,
        shippingPrice: cart.shippingPrice,
        taxPrice: cart.taxPrice,
        totalPrice: cart.totalPrice,
      })
    )
  }

  return (
    <>
      <CheckoutSteps step1 step2 step3 step4 />
      <div className='order-page'>
        <div className='order-page__main'>
          <Card className='order-card'>
            <h2>Shipping</h2>
            <p>
              <strong>Address: </strong>
              {cart.shippingAddress.address}, {cart.shippingAddress.city}{' '}
              {cart.shippingAddress.postalCode}, {cart.shippingAddress.country}
            </p>
          </Card>

          <Card className='order-card'>
            <h2>Payment Method</h2>
            <p>
              <strong>Method: </strong>
              {cart.paymentMethod}
            </p>
          </Card>

          <Card className='order-card'>
            <h2>Order Items</h2>
            {cart.cartItems.length === 0 ? (
              <Message>Your cart is empty</Message>
            ) : (
              <ul className='order-items'>
                {cart.cartItems.map((item, index) => (
                  <li className='order-items__row' key={index}>
                    <img
                      src={item.image}
                      alt={item.name}
                      className='order-items__image'
                    />
                    <Link to={`/product/${item.product}`} className='order-items__name'>
                      {item.name}
                    </Link>
                    <span className='order-items__calc'>
                      {item.qty} × ${item.price} = ${(item.qty * item.price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card as='aside' className='order-page__summary'>
          <h2 className='order-summary__heading'>Order Summary</h2>
          <div className='order-summary__row'>
            <span>Items</span><span>${cart.itemsPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Shipping</span><span>${cart.shippingPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Tax</span><span>${cart.taxPrice}</span>
          </div>
          <div className='order-summary__row order-summary__row--total'>
            <span>Total</span>
            <span className='order-summary__total'>${cart.totalPrice}</span>
          </div>
          {error && <Message variant='danger'>{error}</Message>}
          <Button
            variant='primary'
            disabled={cart.cartItems.length === 0}
            onClick={placeOrderHandler}
            className='order-summary__action'
          >
            Place Order
          </Button>
        </Card>
      </div>
    </>
  )
}

export default PlaceOrderScreen
