import React from 'react'
import { Spinner } from 'react-bootstrap'
import './Loader.css'

const Loader = () => (
  <Spinner animation='border' role='status' className='app-loader'>
    <span className='sr-only'>Loading...</span>
  </Spinner>
)

export default Loader
