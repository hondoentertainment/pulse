// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@phosphor-icons/react', () => ({
  ArrowLeft: (p: any) => <span data-testid="icon-ArrowLeft" {...p} />,
}))

import { LegalPage } from '@/components/LegalPage'

describe('LegalPage', () => {
  it('renders the privacy policy', () => {
    render(<LegalPage doc="privacy" onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /Privacy Policy/i })).toBeInTheDocument()
    expect(screen.getByText(/We do not sell your personal data/i)).toBeInTheDocument()
    expect(screen.getByText(/at least 18 years old/i)).toBeInTheDocument()
  })

  it('renders the terms of service', () => {
    render(<LegalPage doc="terms" onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /Terms of Service/i })).toBeInTheDocument()
    expect(screen.getByText(/Posting fake check-ins/i)).toBeInTheDocument()
  })

  it('calls onBack from the back button', () => {
    const onBack = vi.fn()
    render(<LegalPage doc="privacy" onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /Back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
