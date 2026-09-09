// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/VenueApp', () => ({
  default: () => <div>Venue shell</div>,
}))

describe('App', () => {
  it('always mounts the venue shell', async () => {
    const { default: App } = await import('@/App')
    render(<App />)
    expect(screen.getByText('Venue shell')).toBeInTheDocument()
  })
})
