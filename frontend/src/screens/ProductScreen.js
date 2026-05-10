import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Rating from '../components/Rating'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Meta from '../components/Meta'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import {
  listProductDetails,
  createProductReview,
} from '../actions/productActions'
import { PRODUCT_CREATE_REVIEW_RESET } from '../constants/productConstants'
import './ProductScreen.css'

const ProductScreen = ({ history, match }) => {
  const [qty, setQty] = useState(1)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const dispatch = useDispatch()

  const productDetails = useSelector((state) => state.productDetails)
  const { loading, error, product } = productDetails

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const productReviewCreate = useSelector((state) => state.productReviewCreate)
  const {
    success: successProductReview,
    loading: loadingProductReview,
    error: errorProductReview,
  } = productReviewCreate

  useEffect(() => {
    if (successProductReview) {
      setRating(0)
      setComment('')
    }
    if (!product._id || product._id !== match.params.id) {
      dispatch(listProductDetails(match.params.id))
      dispatch({ type: PRODUCT_CREATE_REVIEW_RESET })
    }
  }, [dispatch, match, successProductReview])

  const addToCartHandler = () => {
    history.push(`/cart/${match.params.id}?qty=${qty}`)
  }

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(createProductReview(match.params.id, { rating, comment }))
  }

  return (
    <>
      <Link to='/' className='ui-btn ui-btn--secondary ui-btn--sm product-page__back'>
        ‹ Go Back
      </Link>
      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <>
          <Meta title={product.name} />
          <div className='product-page'>
            <div>
              <img src={product.image} alt={product.name} className='product-page__image' />
            </div>
            <div>
              <h1 className='product-page__name'>{product.name}</h1>
              <Rating value={product.rating} text={`${product.numReviews} reviews`} />
              <div className='product-page__price product-page__price--inline'>${product.price}</div>
              <p className='product-page__description'>{product.description}</p>
            </div>
            <Card className='product-page__sidebar'>
              <div className='product-page__sidebar-row'>
                <span>Price</span>
                <span className='product-page__price'>${product.price}</span>
              </div>
              <div className='product-page__sidebar-row'>
                <span>Status</span>
                <Badge variant={product.countInStock > 0 ? 'primary' : 'danger'}>
                  {product.countInStock > 0 ? 'In Stock' : 'Out Of Stock'}
                </Badge>
              </div>
              {product.countInStock > 0 && (
                <div className='product-page__sidebar-row'>
                  <label htmlFor='qty-select'>Qty</label>
                  <select
                    id='qty-select'
                    className='product-page__qty'
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  >
                    {[...Array(product.countInStock).keys()].map((x) => (
                      <option key={x + 1} value={x + 1}>{x + 1}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className='product-page__sidebar-row'>
                <Button
                  variant='primary'
                  onClick={addToCartHandler}
                  disabled={product.countInStock === 0}
                  className='product-page__add-to-cart'
                >
                  Add To Cart
                </Button>
              </div>
            </Card>
          </div>

          <div className='product-reviews'>
            <h2 className='product-reviews__heading'>Reviews</h2>
            {product.reviews.length === 0 && <Message>No Reviews</Message>}
            {product.reviews.map((review) => (
              <div className='product-reviews__item' key={review._id}>
                <div className='product-reviews__author'>{review.name}</div>
                <Rating value={review.rating} />
                <p className='product-reviews__date'>{review.createdAt.substring(0, 10)}</p>
                <p>{review.comment}</p>
              </div>
            ))}

            <div className='product-reviews__form'>
              <h2 className='product-reviews__heading'>Write a Customer Review</h2>
              {successProductReview && (
                <Message variant='success'>Review submitted successfully</Message>
              )}
              {loadingProductReview && <Loader />}
              {errorProductReview && (
                <Message variant='danger'>{errorProductReview}</Message>
              )}
              {userInfo ? (
                <form onSubmit={submitHandler}>
                  <div className='product-reviews__field'>
                    <label htmlFor='review-rating' className='product-reviews__label'>Rating</label>
                    <select
                      id='review-rating'
                      className='product-page__qty product-reviews__select'
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                    >
                      <option value=''>Select...</option>
                      <option value='1'>1 - Poor</option>
                      <option value='2'>2 - Fair</option>
                      <option value='3'>3 - Good</option>
                      <option value='4'>4 - Very Good</option>
                      <option value='5'>5 - Excellent</option>
                    </select>
                  </div>
                  <div className='product-reviews__field'>
                    <label htmlFor='review-comment' className='product-reviews__label'>Comment</label>
                    <textarea
                      id='review-comment'
                      className='product-page__qty product-reviews__textarea'
                      rows='3'
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <Button
                    variant='primary'
                    type='submit'
                    loading={loadingProductReview}
                  >
                    Submit Review
                  </Button>
                </form>
              ) : (
                <Message>
                  Please <Link to='/login'>sign in</Link> to write a review
                </Message>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default ProductScreen
