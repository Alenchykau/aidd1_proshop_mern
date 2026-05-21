import React from 'react'
import { useHistory } from 'react-router-dom'
import Pagination from './ui/Pagination'

const Paginate = ({ pages, page, isAdmin = false, keyword = '' }) => {
  const history = useHistory()

  if (!pages || pages <= 1) return null

  const buildUrl = (p) => {
    if (isAdmin) return `/admin/productlist/${p}`
    if (keyword) return `/search/${keyword}/page/${p}`
    return `/page/${p}`
  }

  return (
    <Pagination
      currentPage={page}
      totalPages={pages}
      onPageChange={(p) => history.push(buildUrl(p))}
    />
  )
}

export default Paginate
