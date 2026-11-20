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

  it('prefers Firefox openOrClosedShadowRoot when the element has it', () => {
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'closed' })
    Object.assign(host, { openOrClosedShadowRoot: () => root })
    const chromeDom = vi.spyOn(chrome.dom, 'openOrClosedShadowRoot')

    expect(shadowRootOf(host)).toBe(root)
    expect(chromeDom).not.toHaveBeenCalled()
  })
})
