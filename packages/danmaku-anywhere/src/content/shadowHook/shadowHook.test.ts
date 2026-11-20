import { describe, expect, it, vi } from 'vitest'
import { SHADOW_ROOT_ATTACHED_EVENT } from '@/content/common/shadowDom/shadowRootAttachedEvent'
import './index.iife'

describe('attachShadow hook', () => {
  it('announces an open root from its host, reaching document listeners', () => {
    const listener = vi.fn((event: Event) => event.composedPath()[0])
    document.addEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
    const host = document.createElement('div')
    document.body.append(host)

    const root = host.attachShadow({ mode: 'open' })

    expect(root).toBe(host.shadowRoot)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.results[0].value).toBe(host)
    document.removeEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
  })

  it('stays silent for closed roots', () => {
    const listener = vi.fn()
    document.addEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
    const host = document.createElement('div')
    document.body.append(host)

    host.attachShadow({ mode: 'closed' })

    expect(listener).not.toHaveBeenCalled()
    document.removeEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
  })
})
