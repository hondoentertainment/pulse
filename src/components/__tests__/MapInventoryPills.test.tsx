// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapInventoryPills } from '@/components/MapInventoryPills'

describe('MapInventoryPills', () => {
  it('renders Launch 33, All Seattle, and Near me', () => {
    render(
      <MapInventoryPills
        inventoryLayer="curated"
        nearMeActive={false}
        onInventoryLayerChange={vi.fn()}
        onToggleNearMe={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Launch 33' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All Seattle' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Near me' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches inventory and near me', () => {
    const onLayer = vi.fn()
    const onNear = vi.fn()
    render(
      <MapInventoryPills
        inventoryLayer="curated"
        nearMeActive={false}
        onInventoryLayerChange={onLayer}
        onToggleNearMe={onNear}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'All Seattle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    expect(onLayer).toHaveBeenCalledWith('all')
    expect(onNear).toHaveBeenCalled()
  })
})
