import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import FormCard from '../components/ui/FormCard'
import Button from '../components/ui/Button'
import CheckoutSteps from '../components/CheckoutSteps'
import { savePaymentMethod } from '../actions/cartActions'
import './PaymentScreen.css'

const PaymentScreen = ({ history }) => {
  const cart = useSelector((state) => state.cart)
  const { shippingAddress } = cart

  if (!shippingAddress.address) {
    history.push('/shipping')
  }

  const [paymentMethod, setPaymentMethod] = useState('PayPal')

  const dispatch = useDispatch()

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(savePaymentMethod(paymentMethod))
    history.push('/placeorder')
  }

  return (
    <>
      <CheckoutSteps step1 step2 step3 />
      <FormCard title='Payment Method'>
        <form onSubmit={submitHandler}>
          <fieldset className='payment__fieldset'>
            <legend className='payment__legend'>Select Method</legend>
            <label className='payment__option'>
              <input
                type='radio'
                id='PayPal'
                name='paymentMethod'
                value='PayPal'
                checked={paymentMethod === 'PayPal'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>PayPal or Credit Card</span>
            </label>
            {/* <label className='payment__option'>
              <input
                type='radio'
                id='Stripe'
                name='paymentMethod'
                value='Stripe'
                checked={paymentMethod === 'Stripe'}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              <span>Stripe</span>
            </label> */}
          </fieldset>
          <Button type='submit' variant='primary'>
            Continue
          </Button>
        </form>
      </FormCard>
    </>
  )
}

export default PaymentScreen
