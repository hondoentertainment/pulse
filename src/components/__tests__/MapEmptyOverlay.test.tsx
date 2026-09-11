// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapEmptyOverlay } from '@/components/MapEmptyOverlay'

describe('MapEmptyOverlay', () => {
  it('stays hidden while pins are in view or the catalog is still loading', () => {
    const { rerender } = render(
      <MapEmptyOverlay
        catalogCount={12}
        filteredCount={12}
        inViewCount={3}
        onShowCatalog={vi.fn()}
      />,
    )
    expect(screen.queryByText(/Seattle pins/)).not.toBeInTheDocument()

    rerender(
      <MapEmptyOverlay
        catalogCount={0}
        filteredCount={0}
        inViewCount={0}
        onShowCatalog={vi.fn()}
      />,
    )
    expect(screen.queryByText(/No Venues in View/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Seattle pins/)).not.toBeInTheDocument()
  })

  it('offers Show Seattle when the catalog exists but the camera missed it', () => {
    const onShowCatalog = vi.fn()
    render(
      <MapEmptyOverlay
        catalogCount={12}
        filteredCount={12}
        inViewCount={0}
        onShowCatalog={onShowCatalog}
      />,
    )
    expect(screen.getByText('Seattle pins are just off-screen')).toBeInTheDocument()
    expect(screen.queryByText(/No Venues in View/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show Seattle' }))
    expect(onShowCatalog).toHaveBeenCalled()
  })

  it('lets guests clear filters that hid every pin', () => {
    const onClearFilters = vi.fn()
    render(
      <MapEmptyOverlay
        catalogCount={12}
        filteredCount={0}
        inViewCount={0}
        onShowCatalog={vi.fn()}
        onClearFilters={onClearFilters}
      />,
    )
    expect(screen.getByText('Filters hid Seattle pins')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClearFilters).toHaveBeenCalled()
  })
})
