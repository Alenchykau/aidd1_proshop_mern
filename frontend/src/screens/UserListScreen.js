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
