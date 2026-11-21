import { describe, expect, it, vi } from 'vitest'
import { shadowRootOf } from './shadowRootOf'

describe('shadowRootOf', () => {
  it('returns an open root directly', () => {
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'open' })
    expect(shadowRootOf(host)).toBe(root)
  })

  it('returns null for an element without a root', () => {
    expect(shadowRootOf(document.createElement('div'))).toBeNull()
  })

  it('opens a closed root through chrome.dom', () => {
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'closed' })
    const open = vi
      .spyOn(chrome.dom, 'openOrClosedShadowRoot')
      .mockReturnValue(root)

    expect(shadowRootOf(host)).toBe(root)
    expect(open).toHaveBeenCalledWith(host)
  })

  it("reads Firefox's openOrClosedShadowRoot property when the element has it", () => {
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'closed' })
    Object.defineProperty(host, 'openOrClosedShadowRoot', {
      get: () => root,
    })

    expect(shadowRootOf(host)).toBe(root)
  })

  it('returns null when the Firefox property says there is no root', () => {
    const host = document.createElement('div')
    Object.defineProperty(host, 'openOrClosedShadowRoot', {
      get: () => null,
    })

    expect(shadowRootOf(host)).toBeNull()
  })
})
