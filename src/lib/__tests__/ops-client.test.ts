import { describe, expect, it } from 'vitest'
import { isAdminSession } from '../ops-client'

describe('ops admin gate', () => {
  it('requires app_metadata.role admin', () => {
    expect(isAdminSession(null)).toBe(false)
    expect(isAdminSession({ user: { app_metadata: { role: 'user' } } })).toBe(false)
    expect(isAdminSession({ user: { app_metadata: { role: 'admin' } } })).toBe(true)
  })
})
