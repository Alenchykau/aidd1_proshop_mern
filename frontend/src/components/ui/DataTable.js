import React from 'react'
import './DataTable.css'

function getCellClass(col) {
  return [
    col.mono ? 'is-mono' : '',
    col.align === 'right' ? 'is-right' : '',
    col.align === 'center' ? 'is-center' : '',
  ].filter(Boolean).join(' ')
}

const DataTable = ({
  columns = [],
  rows = [],
  loading = false,
  emptyState = null,
  rowKey = 'id',
  className = '',
}) => {
  const skeletonRows = 6

  return (
    <div className={`ui-table-wrap ${className}`.trim()}>
      <table className='ui-table'>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={getCellClass(c)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: skeletonRows }).map((_, i) => (
            <tr key={`sk-${i}`}>
              {columns.map((c) => (
                <td key={c.key} className={getCellClass(c)}>
                  <span className='ui-skeleton' />
                </td>
              ))}
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className='ui-table__empty'>
                {emptyState}
              </td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((c) => (
                <td key={c.key} className={getCellClass(c)}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
