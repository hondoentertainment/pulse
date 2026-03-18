// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GoingTonightButton } from '../GoingTonightButton'
import type { User } from '@/lib/types'
import type { VenueRSVP } from '@/lib/going-tonight'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileTap, initial, animate, transition, exit, ...props }: Record<string, unknown>) => <button {...props}>{children as React.ReactNode}</button>,
    div: ({ children, whileTap, initial, animate, transition, exit, variants, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}))

function makeUser(id: string, username: string): User {
  return {
    id,
    username,
    profilePhoto: `https://example.com/${id}.jpg`,
    friends: [],
    createdAt: new Date().toISOString(),
  }
}

function makeRSVP(status: 'going' | 'maybe' | 'cancelled'): VenueRSVP {
  return {
    userId: 'current-user',
    venueId: 'v1',
    timestamp: new Date().toISOString(),
    status,
    arrivalEstimate: status === 'going' ? 'Around 10' : undefined,
  }
}

const defaultProps = {
  venueId: 'v1',
  currentStatus: null,
  friendsGoing: [] as User[],
  onMarkGoing: vi.fn(),
  onMarkMaybe: vi.fn(),
  onCancel: vi.fn(),
}

describe('GoingTonightButton', () => {
  // ── Three button states ──────────────────────────────────

  describe('button states', () => {
    it('renders "not going" state when no status', () => {
      render(<GoingTonightButton {...defaultProps} />)

      const button = screen.getByTestId('going-tonight-button')
      expect(button.getAttribute('data-status')).toBe('none')
      expect(button.textContent).toContain('Going Tonight?')
    })

    it('renders "going" state with solid styling', () => {
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('going')}
        />
      )

      const button = screen.getByTestId('going-tonight-button')
      expect(button.getAttribute('data-status')).toBe('going')
      expect(button.textContent).toContain("I'm Going Tonight")
    })

    it('renders "maybe" state with dashed styling', () => {
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('maybe')}
        />
      )

      const button = screen.getByTestId('going-tonight-button')
      expect(button.getAttribute('data-status')).toBe('maybe')
      expect(button.textContent).toContain('Maybe Tonight')
    })

    it('shows arrival estimate when going', () => {
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('going')}
        />
      )

      const button = screen.getByTestId('going-tonight-button')
      expect(button.textContent).toContain('Around 10')
    })
  })

  // ── Tap cycling ──────────────────────────────────────────

  describe('tap cycling', () => {
    it('calls onMarkGoing when tapping from "none" state', () => {
      const onMarkGoing = vi.fn()
      render(
        <GoingTonightButton
          {...defaultProps}
          onMarkGoing={onMarkGoing}
        />
      )

      fireEvent.click(screen.getByTestId('going-tonight-button'))
      expect(onMarkGoing).toHaveBeenCalledWith('v1')
    })

    it('opens menu when tapping from "going" state', () => {
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('going')}
        />
      )

      fireEvent.click(screen.getByTestId('going-tonight-button'))
      expect(screen.getByTestId('going-menu')).toBeTruthy()
    })

    it('opens menu when tapping from "maybe" state', () => {
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('maybe')}
        />
      )

      fireEvent.click(screen.getByTestId('going-tonight-button'))
      expect(screen.getByTestId('going-menu')).toBeTruthy()
    })

    it('can cancel from the menu', () => {
      const onCancel = vi.fn()
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('going')}
          onCancel={onCancel}
        />
      )

      fireEvent.click(screen.getByTestId('going-tonight-button'))
      fireEvent.click(screen.getByTestId('menu-cancel'))
      expect(onCancel).toHaveBeenCalledWith('v1')
    })

    it('can switch to maybe from the menu', () => {
      const onMarkMaybe = vi.fn()
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('going')}
          onMarkMaybe={onMarkMaybe}
        />
      )

      fireEvent.click(screen.getByTestId('going-tonight-button'))
      fireEvent.click(screen.getByTestId('menu-maybe'))
      expect(onMarkMaybe).toHaveBeenCalledWith('v1')
    })
  })

  // ── Friend avatar display ────────────────────────────────

  describe('friend avatars', () => {
    it('shows friend avatars when friends are going', () => {
      const friends = [makeUser('f1', 'Sarah'), makeUser('f2', 'Mike')]
      render(
        <GoingTonightButton
          {...defaultProps}
          friendsGoing={friends}
        />
      )

      expect(screen.getByTestId('friend-avatars')).toBeTruthy()
      const images = screen.getByTestId('friend-avatars').querySelectorAll('img')
      expect(images).toHaveLength(2)
    })

    it('shows max 3 avatars with overflow count', () => {
      const friends = [
        makeUser('f1', 'Sarah'),
        makeUser('f2', 'Mike'),
        makeUser('f3', 'Alex'),
        makeUser('f4', 'Jordan'),
        makeUser('f5', 'Taylor'),
      ]
      render(
        <GoingTonightButton
          {...defaultProps}
          friendsGoing={friends}
        />
      )

      const images = screen.getByTestId('friend-avatars').querySelectorAll('img')
      expect(images).toHaveLength(3)
      expect(screen.getByTestId('avatar-overflow').textContent).toBe('+2')
    })

    it('does not show avatars when no friends going', () => {
      render(<GoingTonightButton {...defaultProps} />)
      expect(screen.queryByTestId('friend-avatars')).toBeNull()
    })
  })

  // ── Arrival time selection ───────────────────────────────

  describe('arrival time selection', () => {
    it('shows arrival time picker from the menu', () => {
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('going')}
        />
      )

      // Open menu
      fireEvent.click(screen.getByTestId('going-tonight-button'))
      // Click "Set Arrival Time"
      fireEvent.click(screen.getByTestId('menu-arrival'))

      // Should see arrival options via test IDs
      expect(screen.getByTestId('arrival-Around 9')).toBeTruthy()
      expect(screen.getByTestId('arrival-Around 10')).toBeTruthy()
      expect(screen.getByTestId('arrival-Around 11')).toBeTruthy()
      expect(screen.getByTestId('arrival-Late night')).toBeTruthy()
    })

    it('calls onMarkGoing with arrival time when selected', () => {
      const onMarkGoing = vi.fn()
      render(
        <GoingTonightButton
          {...defaultProps}
          currentStatus={makeRSVP('going')}
          onMarkGoing={onMarkGoing}
        />
      )

      fireEvent.click(screen.getByTestId('going-tonight-button'))
      fireEvent.click(screen.getByTestId('menu-arrival'))
      fireEvent.click(screen.getByTestId('arrival-Around 11'))

      expect(onMarkGoing).toHaveBeenCalledWith('v1', 'Around 11')
    })
  })
})
