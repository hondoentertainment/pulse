// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MapEnergyPills } from '@/components/MapEnergyPills'

describe('MapEnergyPills', () => {
  it('renders Electric, Buzzing, and Near me', () => {
    render(
      <MapEnergyPills
        energyLevels={[]}
        nearMeActive={false}
        onToggleEnergy={vi.fn()}
        onToggleNearMe={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Electric' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Buzzing' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Near me' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles energy and near-me filters', () => {
    const onToggleEnergy = vi.fn()
    const onToggleNearMe = vi.fn()
    render(
      <MapEnergyPills
        energyLevels={['electric']}
        nearMeActive={true}
        onToggleEnergy={onToggleEnergy}
        onToggleNearMe={onToggleNearMe}
      />,
    )
    expect(screen.getByRole('button', { name: 'Electric' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Buzzing' }))
    expect(onToggleEnergy).toHaveBeenCalledWith('buzzing')
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    expect(onToggleNearMe).toHaveBeenCalled()
  })
})
