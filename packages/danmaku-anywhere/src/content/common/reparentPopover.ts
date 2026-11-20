import { shadowRootOf } from './shadowDom/shadowRootOf'

/**
 * When video becomes full screen, the popover (content script) will be visible on top of the video,
 * but will become "inert" and non-interactive.
 * To maintain interactivity, we need to re-parent the popover into the fullscreen element.
 * https://github.com/whatwg/html/issues/10811
 */
export function reparentPopover(
  popover: HTMLDivElement,
  document: Document,
  target: Element | null
) {
  if (!target) {
    // if no target, reparent to body and show the popover
    if (popover.parentElement !== document.body) {
      document.body.appendChild(popover)
    }
    popover.hidePopover()
    popover.showPopover()
    return
  }

  if (!canHoldPopover(target)) {
    // Cannot reparent to these elements, hide and show so the popover will be visible on top of the video
    popover.hidePopover()
    popover.showPopover()
  } else {
    // A shadow host only renders its shadow tree, so a light DOM child of a
    // web component in fullscreen is not drawn at all.
    const container = shadowRootOf(target) ?? target
    if (popover.parentNode !== container) {
      container.appendChild(popover)
    }
    popover.hidePopover()
    popover.showPopover()
  }
}

export function canHoldPopover(element: Element): boolean {
  return element.nodeName !== 'VIDEO' && element.nodeName !== 'IFRAME'
}
