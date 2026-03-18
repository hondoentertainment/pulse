// @vitest-environment jsdom

import type { HTMLAttributes } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmojiReactionBar } from '../EmojiReactionBar'
import { REACTION_EMOJIS, type ReactionType } from '@/lib/emoji-reactions'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}))

function makeEmptyCounts(): Record<ReactionType, number> {
  return {
    fire: 0,
    music: 0,
    dancing: 0,
    drinks: 0,
    electric: 0,
    love: 0,
    chill: 0,
    vip: 0,
  }
}

describe('EmojiReactionBar', () => {
  it('renders all 8 emoji buttons', () => {
    render(
      <EmojiReactionBar
        onReaction={vi.fn()}
        reactionCounts={makeEmptyCounts()}
      />
    )

    const types: ReactionType[] = ['fire', 'music', 'dancing', 'drinks', 'electric', 'love', 'chill', 'vip']
    for (const type of types) {
      expect(screen.getByTestId(`reaction-btn-${type}`)).toBeTruthy()
    }
  })

  it('each button has correct aria-label', () => {
    render(
      <EmojiReactionBar
        onReaction={vi.fn()}
        reactionCounts={makeEmptyCounts()}
      />
    )

    for (const [type, config] of Object.entries(REACTION_EMOJIS)) {
      const btn = screen.getByTestId(`reaction-btn-${type}`)
      expect(btn.getAttribute('aria-label')).toBe(`${config.label} reaction`)
    }
  })

  it('calls onReaction when button is clicked', () => {
    const onReaction = vi.fn()
    render(
      <EmojiReactionBar
        onReaction={onReaction}
        reactionCounts={makeEmptyCounts()}
      />
    )

    const fireBtn = screen.getByTestId('reaction-btn-fire')
    fireEvent.click(fireBtn)

    expect(onReaction).toHaveBeenCalledTimes(1)
    expect(onReaction).toHaveBeenCalledWith('fire', expect.any(Number), expect.any(Number))
  })

  it('displays reaction count when greater than 0', () => {
    const counts = { ...makeEmptyCounts(), fire: 42, love: 1500 }
    render(
      <EmojiReactionBar
        onReaction={vi.fn()}
        reactionCounts={counts}
      />
    )

    expect(screen.getByTestId('reaction-count-fire').textContent).toBe('42')
    expect(screen.getByTestId('reaction-count-love').textContent).toBe('1.5K')
  })

  it('does not display count when 0', () => {
    render(
      <EmojiReactionBar
        onReaction={vi.fn()}
        reactionCounts={makeEmptyCounts()}
      />
    )

    expect(screen.queryByTestId('reaction-count-fire')).toBeNull()
  })

  it('applies active styling when activeType is set', () => {
    render(
      <EmojiReactionBar
        onReaction={vi.fn()}
        reactionCounts={makeEmptyCounts()}
        activeType="fire"
      />
    )

    const fireBtn = screen.getByTestId('reaction-btn-fire')
    expect(fireBtn.className).toContain('ring-2')
  })
})
