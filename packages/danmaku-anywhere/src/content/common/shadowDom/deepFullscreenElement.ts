/**
 * document.fullscreenElement is retargeted to the outermost shadow host when
 * the element in fullscreen lives in a shadow root. This follows open shadow
 * roots down to the element that actually is in fullscreen.
 */
export function getDeepFullscreenElement(doc: Document): Element | null {
  let element = doc.fullscreenElement
  while (element?.shadowRoot?.fullscreenElement) {
    element = element.shadowRoot.fullscreenElement
  }
  return element
}
