import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHADOW_ROOT_ATTACHED_EVENT } from '@/content/common/shadowDom/shadowRootAttachedEvent'
import './index.iife'

afterEach(() => {
  document.body.replaceChildren()
})

describe('attachShadow hook', () => {
  it.each([
    'open',
    'closed',
  ] as const)('announces a %s root from its host to the host tree', (mode) => {
    const listener = vi.fn((event: Event) => event.target)
    document.addEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
    const host = document.createElement('div')
    document.body.append(host)

    const root = host.attachShadow({ mode })

    expect(root.mode).toBe(mode)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.results[0].value).toBe(host)
    document.removeEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
  })

  it('does not leave the shadow root the host sits in', () => {
    const outer = document.createElement('div')
    const outerRoot = outer.attachShadow({ mode: 'closed' })
    document.body.append(outer)
    const inner = document.createElement('div')
    outerRoot.append(inner)
    const onDocument = vi.fn()
    const onOuterRoot = vi.fn((event: Event) => event.target)
    document.addEventListener(SHADOW_ROOT_ATTACHED_EVENT, onDocument, true)
    outerRoot.addEventListener(SHADOW_ROOT_ATTACHED_EVENT, onOuterRoot, true)

    inner.attachShadow({ mode: 'closed' })

    expect(onOuterRoot.mock.results[0]?.value).toBe(inner)
    expect(onDocument).not.toHaveBeenCalled()
    document.removeEventListener(SHADOW_ROOT_ATTACHED_EVENT, onDocument, true)
  })

  it('cannot be constructed, like the native attachShadow', () => {
    const hooked = Element.prototype.attachShadow

    expect(Object.hasOwn(hooked, 'prototype')).toBe(false)
    expect(() => Reflect.construct(hooked, [{ mode: 'open' }])).toThrow(
      TypeError
    )
  })

  it('passes through the native error for a second root on one host', () => {
    const host = document.createElement('div')
    host.attachShadow({ mode: 'open' })

    expect(() => host.attachShadow({ mode: 'open' })).toThrow(DOMException)
  })

  it('still attaches when the page later breaks Event and dispatchEvent', () => {
    const listener = vi.fn()
    document.addEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
    const pageDispatch = vi
      .spyOn(EventTarget.prototype, 'dispatchEvent')
      .mockImplementation(() => {
        throw new Error('page override')
      })
    vi.stubGlobal('Event', undefined)
    const host = document.createElement('div')
    document.body.append(host)

    const root = host.attachShadow({ mode: 'open' })

    expect(host.shadowRoot).toBe(root)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
    pageDispatch.mockRestore()
    document.removeEventListener(SHADOW_ROOT_ATTACHED_EVENT, listener, true)
  })
})
