// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeedTabBar } from '@/components/ux/FeedTabBar'

describe('FeedTabBar', () => {
  it('marks the selected tab and reports changes', () => {
    const onChange = vi.fn()
    render(
      <FeedTabBar
        ariaLabel="Map home views"
        tabs={[
          { id: 'tonight', label: 'Tonight' },
          { id: 'live', label: 'Live' },
          { id: 'map', label: 'Map' },
        ]}
        value="map"
        onChange={onChange}
      />,
    )
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Tonight' })).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(screen.getByRole('tab', { name: 'Live' }))
    expect(onChange).toHaveBeenCalledWith('live')
  })
})
