// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FirstOpenCoach } from '@/components/FirstOpenCoach'
import { FIRST_OPEN_COACH_DISMISS, FIRST_OPEN_COACH_LINE } from '@/lib/first-open-coach'

describe('FirstOpenCoach', () => {
  it('renders one dismissible first-session line', () => {
    const onDismiss = vi.fn()
    render(<FirstOpenCoach onDismiss={onDismiss} />)
    expect(screen.getByLabelText('First session')).toBeInTheDocument()
    expect(screen.getByText(FIRST_OPEN_COACH_LINE)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: FIRST_OPEN_COACH_DISMISS }))
    expect(onDismiss).toHaveBeenCalled()
  })
})
