import { afterEach, describe, expect, it, vi } from 'vitest'
import { reparentPopover } from './reparentPopover'

function makePopover(): HTMLDivElement {
  const popover = document.createElement('div')
  popover.showPopover = vi.fn()
  popover.hidePopover = vi.fn()
  return popover
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('reparentPopover', () => {
  it('moves the popover into a plain fullscreen element', () => {
    const popover = makePopover()
    const target = document.createElement('div')
    document.body.append(target)

    reparentPopover(popover, document, target)

    expect(popover.parentNode).toBe(target)
    expect(popover.showPopover).toHaveBeenCalled()
  })

  it.each([
    'open',
    'closed',
  ] as const)('moves the popover into the %s shadow root of a fullscreen host', (mode) => {
    const popover = makePopover()
    const host = document.createElement('div')
    const root = host.attachShadow({ mode })
    vi.spyOn(chrome.dom, 'openOrClosedShadowRoot').mockImplementation(
      (element) => {
        return element === host ? root : null
      }
    )
    document.body.append(host)

    reparentPopover(popover, document, host)

    expect(popover.parentNode).toBe(root)
  })

  it('leaves the popover in place for a fullscreen video', () => {
    const popover = makePopover()
    document.body.append(popover)
    const video = document.createElement('video')
    document.body.append(video)

    reparentPopover(popover, document, video)

    expect(popover.parentNode).toBe(document.body)
    expect(popover.showPopover).toHaveBeenCalled()
  })

  it('moves the popover back to body when fullscreen ends', () => {
    const popover = makePopover()
    const host = document.createElement('div')
    host.attachShadow({ mode: 'open' }).append(popover)
    document.body.append(host)

    reparentPopover(popover, document, null)

    expect(popover.parentNode).toBe(document.body)
  })
})
