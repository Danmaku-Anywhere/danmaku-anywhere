import { shadowRootOf } from './shadowRootOf'

/**
 * document.fullscreenElement is retargeted to the outermost shadow host when
 * the element in fullscreen lives in a shadow root. This follows shadow roots
 * down to the element that actually is in fullscreen.
 */
export function getDeepFullscreenElement(doc: Document): Element | null {
  let element = doc.fullscreenElement
  while (element) {
    const inner = shadowRootOf(element)?.fullscreenElement
    if (!inner) {
      break
    }
    element = inner
  }
  return element
}
