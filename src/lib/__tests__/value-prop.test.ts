import { describe, it, expect } from 'vitest'
import { VALUE_PROP, tonightHeaderCopy } from '../value-prop'

describe('VALUE_PROP', () => {
  it('keeps a single clear end-user promise', () => {
    expect(VALUE_PROP.headline.toLowerCase()).toMatch(/guess|tonight|live/)
    expect(VALUE_PROP.subhead).toMatch(/90/)
    expect(VALUE_PROP.primaryCta.length).toBeGreaterThan(0)
    expect(VALUE_PROP.steps).toHaveLength(3)
  })

  it('tonight header reinforces the same promise', () => {
    const h = tonightHeaderCopy()
    expect(h.title.toLowerCase()).toMatch(/live|now/)
    expect(h.subtitle).toMatch(/90/)
  })
})
