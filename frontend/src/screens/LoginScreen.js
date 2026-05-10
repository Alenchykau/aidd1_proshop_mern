import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import { login } from '../actions/userActions'
import './auth-form.css'

const LoginScreen = ({ location, history }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const dispatch = useDispatch()

  const userLogin = useSelector((state) => state.userLogin)
  const { loading, error, userInfo } = userLogin

  const redirect = location.search ? location.search.split('=')[1] : '/'

  useEffect(() => {
    if (userInfo) {
      history.push(redirect)
    }
  }, [history, userInfo, redirect])

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(login(email, password))
  }

  return (
    <FormCard title='Sign In'>
      {error && <Message variant='danger'>{error}</Message>}
      <form onSubmit={submitHandler}>
        <FormField
          id='email'
          label='Email Address'
          type='email'
          placeholder='Enter email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormField
          id='password'
          label='Password'
          type='password'
          placeholder='Enter password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type='submit' variant='primary' loading={loading}>
          Sign In
        </Button>
      </form>

      <p className='auth-form__footer'>
        New Customer?{' '}
        <Link to={redirect ? `/register?redirect=${redirect}` : '/register'}>
          Register
        </Link>
      </p>
    </FormCard>
  )
}

export default LoginScreen
