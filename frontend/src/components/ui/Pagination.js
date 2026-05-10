import React from 'react'
import './Pagination.css'

const Pagination = ({ currentPage = 1, totalPages = 1, onPageChange }) => {
  if (totalPages <= 1) return null

  const pages = []
  for (let p = 1; p <= totalPages; p += 1) pages.push(p)

  const handle = (p) => () => {
    if (p < 1 || p > totalPages || p === currentPage) return
    onPageChange && onPageChange(p)
  }

  return (
    <ul className='ui-pagination' aria-label='Pagination'>
      <li className='ui-pagination__item'>
        <button
          type='button'
          className='ui-pagination__btn'
          onClick={handle(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label='Previous page'
        >
          ‹
        </button>
      </li>
      {pages.map((p) => (
        <li key={p} className='ui-pagination__item'>
          <button
            type='button'
            className={`ui-pagination__btn ${p === currentPage ? 'is-active' : ''}`.trim()}
            onClick={handle(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </button>
        </li>
      ))}
      <li className='ui-pagination__item'>
        <button
          type='button'
          className='ui-pagination__btn'
          onClick={handle(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label='Next page'
        >
          ›
        </button>
      </li>
    </ul>
  )
}

export default Pagination
