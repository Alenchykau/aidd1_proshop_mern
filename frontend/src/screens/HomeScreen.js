import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Row, Col } from 'react-bootstrap'
import Product from '../components/Product'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Paginate from '../components/Paginate'
import ProductCarousel from '../components/ProductCarousel'
import EmptyState from '../components/EmptyState'
import Meta from '../components/Meta'
import { listProducts } from '../actions/productActions'
import './HomeScreen.css'

const HomeScreen = ({ match }) => {
  const keyword = match.params.keyword
  const pageNumber = match.params.pageNumber || 1

  const dispatch = useDispatch()

  const productList = useSelector((state) => state.productList)
  const { loading, error, products, page, pages } = productList

  useEffect(() => {
    dispatch(listProducts(keyword, pageNumber))
  }, [dispatch, keyword, pageNumber])

  return (
    <div className='home-page'>
      <Meta />
      {keyword ? (
        <Link to='/' className='home-back ui-btn ui-btn--secondary ui-btn--sm'>
          ‹ Go Back
        </Link>
      ) : (
        <div className='home-hero'>
          <ProductCarousel />
        </div>
      )}
      <h2 className='home-section-title'>Latest Products</h2>
      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : products.length === 0 ? (
        <div className='home-empty'>
          <EmptyState
            heading='No products found'
            subtitle={keyword ? 'Try a different search term' : 'Catalogue is empty'}
          />
        </div>
      ) : (
        <>
          <Row>
            {products.map((product) => (
              <Col key={product._id} sm={12} md={6} lg={4} xl={3}>
                <Product product={product} />
              </Col>
            ))}
          </Row>
          <Paginate
            pages={pages}
            page={page}
            keyword={keyword ? keyword : ''}
          />
        </>
      )}
    </div>
  )
}

export default HomeScreen
