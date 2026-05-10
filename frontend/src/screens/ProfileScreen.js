import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import DataTable from '../components/ui/DataTable'
import Badge from '../components/ui/Badge'
import { getUserDetails, updateUserProfile } from '../actions/userActions'
import { listMyOrders } from '../actions/orderActions'
import { USER_UPDATE_PROFILE_RESET } from '../constants/userConstants'
import './ProfileScreen.css'

const ProfileScreen = ({ history }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)

  const dispatch = useDispatch()

  const userDetails = useSelector((state) => state.userDetails)
  const { loading, error, user } = userDetails

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const userUpdateProfile = useSelector((state) => state.userUpdateProfile)
  const { loading: loadingUpdate, success } = userUpdateProfile

  const orderListMy = useSelector((state) => state.orderListMy)
  const { loading: loadingOrders, error: errorOrders, orders } = orderListMy

  useEffect(() => {
    if (!userInfo) {
      history.push('/login')
    } else {
      if (!user || !user.name || success) {
        dispatch({ type: USER_UPDATE_PROFILE_RESET })
        dispatch(getUserDetails('profile'))
        dispatch(listMyOrders())
      } else {
        setName(user.name)
        setEmail(user.email)
      }
    }
  }, [dispatch, history, userInfo, user, success])

  const submitHandler = (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
    } else {
      setMessage(null)
      dispatch(updateUserProfile({ id: user._id, name, email, password }))
    }
  }

  const orderColumns = [
    { key: 'id',         header: 'ID',        mono: true,
      render: (o) => o._id },
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
  ]

  return (
    <div className='profile-page'>
      <h1 className='profile-page__title'>User Profile</h1>

      {message && <Message variant='danger'>{message}</Message>}
      {success && <Message variant='success'>Profile Updated</Message>}

      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <FormCard title='Account Info'>
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
            <FormField
              id='password'
              label='Password'
              type='password'
              placeholder='Enter password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormField
              id='confirmPassword'
              label='Confirm Password'
              type='password'
              placeholder='Confirm password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type='submit' variant='primary' loading={loadingUpdate}>
              Update
            </Button>
          </form>
        </FormCard>
      )}

      <h2 className='profile-page__orders-heading'>My Orders</h2>
      {errorOrders && <Message variant='danger'>{errorOrders}</Message>}
      <DataTable
        columns={orderColumns}
        rows={orders || []}
        rowKey='_id'
        loading={loadingOrders}
        emptyState={
          <EmptyState
            heading='No orders yet'
            subtitle='Place your first order'
          />
        }
      />
    </div>
  )
}

export default ProfileScreen
