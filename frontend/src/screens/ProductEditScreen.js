import axios from 'axios'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import FormCard from '../components/ui/FormCard'
import FormField from '../components/ui/FormField'
import Button from '../components/ui/Button'
import { listProductDetails, updateProduct } from '../actions/productActions'
import { PRODUCT_UPDATE_RESET } from '../constants/productConstants'
import './admin-page.css'

const ProductEditScreen = ({ match, history }) => {
  const productId = match.params.id

  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [image, setImage] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [countInStock, setCountInStock] = useState(0)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)

  const dispatch = useDispatch()

  const productDetails = useSelector((state) => state.productDetails)
  const { loading, error, product } = productDetails

  const productUpdate = useSelector((state) => state.productUpdate)
  const {
    loading: loadingUpdate,
    error: errorUpdate,
    success: successUpdate,
  } = productUpdate

  useEffect(() => {
    if (successUpdate) {
      dispatch({ type: PRODUCT_UPDATE_RESET })
      history.push('/admin/productlist')
    } else {
      if (!product.name || product._id !== productId) {
        dispatch(listProductDetails(productId))
      } else {
        setName(product.name)
        setPrice(product.price)
        setImage(product.image)
        setBrand(product.brand)
        setCategory(product.category)
        setCountInStock(product.countInStock)
        setDescription(product.description)
      }
    }
  }, [dispatch, history, productId, product, successUpdate])

  const uploadFileHandler = async (e) => {
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('image', file)
    setUploading(true)

    try {
      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
      const { data } = await axios.post('/api/upload', formData, config)
      setImage(data)
      setUploading(false)
    } catch (error) {
      console.error(error)
      setUploading(false)
    }
  }

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(
      updateProduct({
        _id: productId,
        name,
        price,
        image,
        brand,
        category,
        description,
        countInStock,
      })
    )
  }

  return (
    <>
      <Link to='/admin/productlist'
            className='ui-btn ui-btn--secondary ui-btn--sm admin-page__back'>
        ‹ Go Back
      </Link>
      <FormCard title='Edit Product' width='md'>
        {errorUpdate && <Message variant='danger'>{errorUpdate}</Message>}
        {loading ? (
          <Loader />
        ) : error ? (
          <Message variant='danger'>{error}</Message>
        ) : (
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
              id='price'
              label='Price'
              type='number'
              placeholder='Enter price'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            {image && (
              <img
                src={image}
                alt='Product preview'
                className='admin-form__image-preview'
              />
            )}
            <FormField
              id='image'
              label='Image URL'
              type='text'
              placeholder='Enter image url'
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
            <div className='admin-form__upload'>
              <label htmlFor='image-file'
                     className='ui-btn ui-btn--secondary ui-btn--sm'>
                Choose File
              </label>
              <input
                id='image-file'
                type='file'
                accept='image/*'
                onChange={uploadFileHandler}
              />
              {uploading && <Loader />}
            </div>

            <FormField
              id='brand'
              label='Brand'
              type='text'
              placeholder='Enter brand'
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
            <FormField
              id='countInStock'
              label='Count In Stock'
              type='number'
              placeholder='Enter count in stock'
              value={countInStock}
              onChange={(e) => setCountInStock(e.target.value)}
            />
            <FormField
              id='category'
              label='Category'
              type='text'
              placeholder='Enter category'
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <FormField
              id='description'
              label='Description'
              type='text'
              placeholder='Enter description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <Button type='submit' variant='primary' loading={loadingUpdate}>
              Update
            </Button>
          </form>
        )}
      </FormCard>
    </>
  )
}

export default ProductEditScreen
