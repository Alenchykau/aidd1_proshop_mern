import React from 'react'
import { Link } from 'react-router-dom'
import Card from './ui/Card'
import Rating from './Rating'
import './Product.css'

const Product = ({ product }) => (
  <Card as={Link} to={`/product/${product._id}`} clickable className='product-card'>
    <img src={product.image} alt={product.name} className='product-card__image' />
    <h4 className='product-card__name'>{product.name}</h4>
    <Rating value={product.rating} text={`${product.numReviews} reviews`} />
    <div className='product-card__price'>${product.price}</div>
  </Card>
)

export default Product
