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
