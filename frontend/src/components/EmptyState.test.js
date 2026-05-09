import React from 'react'
import { render } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders heading and subtitle', () => {
    const { getByText } = render(
      <EmptyState heading="Nothing here" subtitle="Try again" />
    )
    expect(getByText('Nothing here')).toBeInTheDocument()
    expect(getByText('Try again')).toBeInTheDocument()
  })

  it('renders the icon SVG when provided', () => {
    const icon = <svg data-testid="my-icon" />
    const { getByTestId } = render(
      <EmptyState icon={icon} heading="x" subtitle="y" />
    )
    expect(getByTestId('my-icon')).toBeInTheDocument()
  })

  it('renders without an icon when none is provided', () => {
    const { container } = render(
      <EmptyState heading="x" subtitle="y" />
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})
