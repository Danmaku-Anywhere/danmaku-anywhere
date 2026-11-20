type FirefoxElement = Element & {
  openOrClosedShadowRoot?: () => ShadowRoot | null
}

/**
 * The host's shadow root, open or closed. Closed roots are only reachable from
 * an extension content script: through chrome.dom in Chrome and through
 * Element.openOrClosedShadowRoot in Firefox. Anywhere else this only sees open
 * roots, the same as host.shadowRoot.
 */
export function shadowRootOf(host: Element): ShadowRoot | null {
  if (host.shadowRoot) {
    return host.shadowRoot
  }
  const firefoxHost = host as FirefoxElement
  if (typeof firefoxHost.openOrClosedShadowRoot === 'function') {
    return firefoxHost.openOrClosedShadowRoot()
  }
  if (
    typeof chrome !== 'undefined' &&
    typeof chrome.dom?.openOrClosedShadowRoot === 'function' &&
    host instanceof HTMLElement
  ) {
    return chrome.dom.openOrClosedShadowRoot(host)
  }
  return null
}
