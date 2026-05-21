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
