import { describe, expect, it } from 'vitest'
import { isAdminSession } from '../ops-client'

describe('ops admin gate', () => {
  it('requires app_metadata.role admin', () => {
    expect(isAdminSession(null)).toBe(false)
    expect(isAdminSession({ user: { app_metadata: { role: 'user' } } })).toBe(false)
    expect(isAdminSession({ user: { app_metadata: { role: 'admin' } } })).toBe(true)
  })

  it('does not treat a regular JWT role as admin without app_metadata', () => {
    expect(isAdminSession({ user: { role: 'authenticated' } })).toBe(false)
  })
})
