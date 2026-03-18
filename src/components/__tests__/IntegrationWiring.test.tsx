// @vitest-environment node

/**
 * Integration wiring verification tests.
 * 
 * These tests verify that the new feature components are correctly wired
 * into their parent components by checking source files for expected
 * imports, hook usage, and component rendering patterns.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, '..', relPath), 'utf-8')
}

describe('ProfileTab - StreakDashboard wiring', () => {
  const src = readSrc('ProfileTab.tsx')

  it('imports StreakCounter component', () => {
    expect(src).toMatch(/import.*StreakCounter.*from/)
  })

  it('imports StreakDashboard component (lazy or direct)', () => {
    expect(src).toContain('StreakDashboard')
    expect(src).toMatch(/(import.*StreakDashboard|lazy.*StreakDashboard)/)
  })

  it('imports useStreakRewards hook', () => {
    expect(src).toMatch(/import.*useStreakRewards.*from/)
  })

  it('calls useStreakRewards with currentUser', () => {
    expect(src).toMatch(/useStreakRewards\(currentUser\)/)
  })

  it('renders streak section with test id', () => {
    expect(src).toContain('data-testid="streak-section"')
  })

  it('renders StreakCounter components', () => {
    expect(src).toContain('<StreakCounter')
  })

  it('renders StreakDashboard component', () => {
    expect(src).toContain('<StreakDashboard')
  })

  it('has toggle to show/hide StreakDashboard', () => {
    expect(src).toContain('showStreakDashboard')
    expect(src).toContain('setShowStreakDashboard')
  })

  it('passes streak data to StreakDashboard', () => {
    expect(src).toContain('allStreaks={streakRewards.allStreaks}')
    expect(src).toContain('activeStreaks={streakRewards.activeStreaks}')
    expect(src).toContain('totalXP={streakRewards.totalXP}')
  })

  it('shows multiplier badge when multiplier > 1', () => {
    expect(src).toContain('currentMultiplier')
  })
})

describe('NeighborhoodView - Walkthrough wiring', () => {
  const src = readSrc('NeighborhoodView.tsx')

  it('imports NeighborhoodWalkthrough component', () => {
    expect(src).toMatch(/NeighborhoodWalkthrough/)
  })

  it('imports useNeighborhoodWalkthrough hook', () => {
    expect(src).toMatch(/import.*useNeighborhoodWalkthrough.*from/)
  })

  it('calls useNeighborhoodWalkthrough with venues and userLocation', () => {
    expect(src).toMatch(/useNeighborhoodWalkthrough\(walkthroughVenues/)
  })

  it('has walkthrough section with test id', () => {
    expect(src).toContain('data-testid="walkthrough-section"')
  })

  it('renders NeighborhoodWalkthrough component', () => {
    expect(src).toContain('<NeighborhoodWalkthrough')
  })

  it('has Bar Crawl button on leaderboard entries', () => {
    expect(src).toContain('Bar Crawl')
  })

  it('passes walkthrough state to component', () => {
    expect(src).toContain('route={walkthrough.activeRoute}')
    expect(src).toContain('currentStopIndex={walkthrough.currentStopIndex}')
    expect(src).toContain('isActive={walkthrough.isActive}')
    expect(src).toContain('isCompleted={walkthrough.isCompleted}')
  })

  it('has close button for walkthrough', () => {
    expect(src).toContain('data-testid="walkthrough-close"')
  })

  it('filters venues by neighborhood', () => {
    expect(src).toContain('walkthroughVenues')
    expect(src).toContain('walkthroughNeighborhood')
  })
})

describe('Map - VenueComparison wiring', () => {
  const src = readSrc('map/index.tsx')

  it('imports VenueComparison component', () => {
    expect(src).toMatch(/import.*VenueComparison.*from/)
  })

  it('imports compareVenues function', () => {
    expect(src).toMatch(/import.*compareVenues.*from/)
  })

  it('computes comparison result', () => {
    expect(src).toContain('comparisonResult')
    expect(src).toContain('compareVenues')
  })

  it('renders VenueComparison component', () => {
    expect(src).toContain('<VenueComparison')
  })

  it('has map venue comparison test id', () => {
    expect(src).toContain('data-testid="map-venue-comparison"')
  })

  it('passes comparison props to VenueComparison', () => {
    expect(src).toContain('selectedVenues={comparisonSelectedVenues}')
    expect(src).toContain('comparisonResult={comparisonResult}')
  })

  it('shows comparison panel when 2+ venues compared', () => {
    expect(src).toContain('comparedVenues.length >= 2')
  })
})

describe('AppShell - OfflineIndicator wiring', () => {
  const src = readSrc('AppShell.tsx')

  it('imports OfflineIndicator component', () => {
    expect(src).toMatch(/import.*OfflineIndicator.*from/)
  })

  it('imports useOfflineCache hook', () => {
    expect(src).toMatch(/import.*useOfflineCache.*from/)
  })

  it('calls useOfflineCache with venues and location', () => {
    expect(src).toContain('useOfflineCache(')
    expect(src).toContain('sortedVenues')
  })

  it('renders OfflineIndicator component', () => {
    expect(src).toContain('<OfflineIndicator')
  })

  it('passes offline cache state to OfflineIndicator', () => {
    expect(src).toContain('isOnline={offlineCache.isOnline}')
    expect(src).toContain('lastSyncTime={offlineCache.lastSyncTime}')
    expect(src).toContain('syncProgress={offlineCache.syncProgress}')
    expect(src).toContain('cacheStats={offlineCache.cacheStats}')
  })

  it('places OfflineIndicator between header and content', () => {
    const headerIdx = src.indexOf('<AppHeader')
    const offlineIdx = src.indexOf('<OfflineIndicator')
    const childrenIdx = src.indexOf('{children}')
    expect(headerIdx).toBeLessThan(offlineIdx)
    expect(offlineIdx).toBeLessThan(childrenIdx)
  })
})
