/**
 * Block person — complement of mute pulse.
 * Blocked people’s pulses leave the viewer’s Tonight. Guest → /auth.
 */

import type { Pulse } from './types'
import { createBlock, type UserBlock } from './content-moderation'
import { buildAuthPath } from './auth-return-intent'

export const BLOCK_PERSON_CTA = 'Block'
export const BLOCK_PERSON_GUEST = 'Sign in to block this person'

export function blockedUserIdsForViewer(
  blocks: readonly UserBlock[],
  viewerId: string,
): Set<string> {
  const ids = new Set<string>()
  for (const block of blocks) {
    if (block.blockerId === viewerId) ids.add(block.blockedUserId)
  }
  return ids
}

export function filterBlockedPulses<T extends Pick<Pulse, 'userId'>>(
  pulses: readonly T[],
  blockedUserIds: ReadonlySet<string>,
): T[] {
  if (blockedUserIds.size === 0) return [...pulses]
  return pulses.filter((pulse) => !blockedUserIds.has(pulse.userId))
}

export function blockPerson(
  blocks: readonly UserBlock[],
  viewerId: string,
  targetUserId: string,
): UserBlock[] {
  if (!viewerId || !targetUserId || viewerId === targetUserId) return [...blocks]
  if (blocks.some((row) => row.blockerId === viewerId && row.blockedUserId === targetUserId)) {
    return [...blocks]
  }
  return [...blocks, createBlock(viewerId, targetUserId)]
}

export function blockPersonAuthPath(venueId?: string): string {
  return buildAuthPath(venueId ? `/venue/${encodeURIComponent(venueId)}` : '/')
}
