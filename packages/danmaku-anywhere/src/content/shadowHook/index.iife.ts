import { SHADOW_ROOT_ATTACHED_EVENT } from '@/content/common/shadowDom/shadowRootAttachedEvent'

// Runs in the page's main world so it sees the page's own attachShadow calls,
// which produce no DOM mutation. The player script in the isolated world
// listens for the event and starts observing the new root.
const attachShadow = Element.prototype.attachShadow

Element.prototype.attachShadow = function (
  this: Element,
  init: ShadowRootInit
): ShadowRoot {
  const root = attachShadow.call(this, init)
  if (init.mode === 'open') {
    this.dispatchEvent(
      new Event(SHADOW_ROOT_ATTACHED_EVENT, { bubbles: true, composed: true })
    )
  }
  return root
}
