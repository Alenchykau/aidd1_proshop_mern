import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { PayPalButton } from 'react-paypal-button-v2'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  getOrderDetails,
  payOrder,
  deliverOrder,
} from '../actions/orderActions'
import {
  ORDER_PAY_RESET,
  ORDER_DELIVER_RESET,
} from '../constants/orderConstants'
import './OrderScreen.css'

const OrderScreen = ({ match, history }) => {
  const orderId = match.params.id

  const [sdkReady, setSdkReady] = useState(false)

  const dispatch = useDispatch()

  const orderDetails = useSelector((state) => state.orderDetails)
  const { order, loading, error } = orderDetails

  const orderPay = useSelector((state) => state.orderPay)
  const { loading: loadingPay, success: successPay } = orderPay

  const orderDeliver = useSelector((state) => state.orderDeliver)
  const { loading: loadingDeliver, success: successDeliver } = orderDeliver

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  if (!loading) {
    const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2)
    order.itemsPrice = addDecimals(
      order.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0)
    )
  }

  useEffect(() => {
    if (!userInfo) {
      history.push('/login')
    }

    const addPayPalScript = async () => {
      const { data: clientId } = await axios.get('/api/config/paypal')
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`
      script.async = true
      script.onload = () => {
        setSdkReady(true)
      }
      document.body.appendChild(script)
    }

    if (!order || successPay || successDeliver || order._id !== orderId) {
      dispatch({ type: ORDER_PAY_RESET })
      dispatch({ type: ORDER_DELIVER_RESET })
      dispatch(getOrderDetails(orderId))
    } else if (!order.isPaid) {
      if (!window.paypal) {
        addPayPalScript()
      } else {
        setSdkReady(true)
      }
    }
  }, [dispatch, orderId, successPay, successDeliver, order])

  const successPaymentHandler = (paymentResult) => {
    dispatch(payOrder(orderId, paymentResult))
  }

  const deliverHandler = () => {
    dispatch(deliverOrder(order))
  }

  if (loading) return <Loader />
  if (error) return <Message variant='danger'>{error}</Message>

  return (
    <>
      <h1 className='order-page__title'>
        Order
        <span className='order-page__title__id'>{order._id}</span>
      </h1>

      <div className='order-page'>
        <div className='order-page__main'>
          <Card className='order-card'>
            <h2>Shipping</h2>
            <p><strong>Name: </strong> {order.user.name}</p>
            <p>
              <strong>Email: </strong>
              <a href={`mailto:${order.user.email}`}>{order.user.email}</a>
            </p>
            <p>
              <strong>Address: </strong>
              {order.shippingAddress.address}, {order.shippingAddress.city}{' '}
              {order.shippingAddress.postalCode}, {order.shippingAddress.country}
            </p>
            <div className='order-card__status'>
              {order.isDelivered ? (
                <Badge variant='primary'>Delivered {order.deliveredAt.substring(0, 10)}</Badge>
              ) : (
                <Badge variant='danger'>Not Delivered</Badge>
              )}
            </div>
          </Card>

          <Card className='order-card'>
            <h2>Payment Method</h2>
            <p><strong>Method: </strong>{order.paymentMethod}</p>
            <div className='order-card__status'>
              {order.isPaid ? (
                <Badge variant='primary'>Paid {order.paidAt.substring(0, 10)}</Badge>
              ) : (
                <Badge variant='danger'>Not Paid</Badge>
              )}
            </div>
          </Card>

          <Card className='order-card'>
            <h2>Order Items</h2>
            {order.orderItems.length === 0 ? (
              <Message>Order is empty</Message>
            ) : (
              <ul className='order-items'>
                {order.orderItems.map((item, index) => (
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
            <span>Items</span><span>${order.itemsPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Shipping</span><span>${order.shippingPrice}</span>
          </div>
          <div className='order-summary__row'>
            <span>Tax</span><span>${order.taxPrice}</span>
          </div>
          <div className='order-summary__row order-summary__row--total'>
            <span>Total</span>
            <span className='order-summary__total'>${order.totalPrice}</span>
          </div>

          {!order.isPaid && (
            <div className='order-summary__action'>
              {loadingPay && <Loader />}
              {!sdkReady ? (
                <Loader />
              ) : (
                <PayPalButton
                  amount={order.totalPrice}
                  onSuccess={successPaymentHandler}
                />
              )}
            </div>
          )}

          {loadingDeliver && <Loader />}
          {userInfo &&
            userInfo.isAdmin &&
            order.isPaid &&
            !order.isDelivered && (
              <Button
                variant='primary'
                onClick={deliverHandler}
                className='order-summary__action'
              >
                Mark As Delivered
              </Button>
            )}
        </Card>
      </div>
    </>
  )
}

export default OrderScreen
