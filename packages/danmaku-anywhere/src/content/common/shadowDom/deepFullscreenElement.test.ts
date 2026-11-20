import { afterEach, describe, expect, it } from 'vitest'
import { getDeepFullscreenElement } from './deepFullscreenElement'

function stubFullscreen(
  target: Document | ShadowRoot,
  element: Element | null
) {
  Object.defineProperty(target, 'fullscreenElement', {
    configurable: true,
    get: () => element,
  })
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenElement')
})

describe('getDeepFullscreenElement', () => {
  it('returns null when nothing is in fullscreen', () => {
    stubFullscreen(document, null)
    expect(getDeepFullscreenElement(document)).toBeNull()
  })

  it('returns a light DOM fullscreen element as is', () => {
    const element = document.createElement('div')
    stubFullscreen(document, element)
    expect(getDeepFullscreenElement(document)).toBe(element)
  })

  it('follows nested open shadow roots to the real fullscreen element', () => {
    const outer = document.createElement('div')
    const outerRoot = outer.attachShadow({ mode: 'open' })
    const inner = document.createElement('div')
    const innerRoot = inner.attachShadow({ mode: 'open' })
    const player = document.createElement('div')
    innerRoot.append(player)
    outerRoot.append(inner)

    stubFullscreen(document, outer)
    stubFullscreen(outerRoot, inner)
    stubFullscreen(innerRoot, player)

    expect(getDeepFullscreenElement(document)).toBe(player)
  })
})
