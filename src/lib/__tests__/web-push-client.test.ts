import { describe, expect, it, vi } from 'vitest'
import {
  subscribeWebPush,
  unsubscribeWebPush,
  WEB_PUSH_COPY,
} from '../web-push-client'

describe('web push client', () => {
  it('no-ops honestly when VAPID keys are missing', async () => {
    const persist = vi.fn()
    const result = await subscribeWebPush({
      vapidPublicKey: null,
      persist,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('missing_vapid')
      expect(result.message).toBe(WEB_PUSH_COPY.missingKeys)
    }
    expect(persist).not.toHaveBeenCalled()
  })

  it('subscribes and persists when permission is granted', async () => {
    const persist = vi.fn(async () => undefined)
    const unsubscribe = vi.fn(async () => true)
    const subscription = {
      endpoint: 'https://push.example/1',
      toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }),
      unsubscribe,
    }
    const result = await subscribeWebPush({
      vapidPublicKey: 'BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      notificationSupported: true,
      serviceWorkerSupported: true,
      requestPermission: async () => 'granted',
      getRegistration: async () => ({
        pushManager: {
          subscribe: async () => subscription,
          getSubscription: async () => subscription,
        },
      } as unknown as ServiceWorkerRegistration),
      persist,
    })
    expect(result.ok).toBe(true)
    expect(persist).toHaveBeenCalled()
  })

  it('unsubscribes an existing subscription', async () => {
    const remove = vi.fn(async () => undefined)
    const unsubscribe = vi.fn(async () => true)
    const result = await unsubscribeWebPush({
      getRegistration: async () => ({
        pushManager: {
          getSubscription: async () => ({
            endpoint: 'https://push.example/1',
            unsubscribe,
          }),
        },
      } as unknown as ServiceWorkerRegistration),
      remove,
    })
    expect(result.ok).toBe(true)
    expect(unsubscribe).toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('https://push.example/1')
  })
})
