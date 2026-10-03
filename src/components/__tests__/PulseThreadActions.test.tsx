// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PulseThreadActions } from '@/components/PulseThreadActions'

describe('PulseThreadActions', () => {
  it('one-tap reply and Same stay on the pulse with count only', () => {
    const onReply = vi.fn()
    const onSame = vi.fn()
    render(
      <PulseThreadActions
        pulseId="p1"
        venueId="neumos"
        authorUserId="other"
        viewerId="me"
        doorChips={['line']}
        replies={[{
          id: 'r1',
          pulseId: 'p1',
          venueId: 'neumos',
          userId: 'you',
          body: 'Here too',
          createdAt: '2026-09-14T04:00:00.000Z',
        }]}
        agrees={[{ pulseId: 'p1', userId: 'a', createdAt: '2026-09-14T04:00:00.000Z' }]}
        onReply={onReply}
        onSame={onSame}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(onReply).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByRole('button', { name: /Same 1/ }))
    expect(onSame).toHaveBeenCalledWith('p1')
    expect(screen.getByText('Here too')).toBeInTheDocument()
  })
})
