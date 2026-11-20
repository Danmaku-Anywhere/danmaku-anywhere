import { SHADOW_ROOT_ATTACHED_EVENT } from '@/content/common/shadowDom/shadowRootAttachedEvent'

// Runs in the page's main world so it sees the page's own attachShadow calls,
// which produce no DOM mutation. The player script in the isolated world
// listens for the event and starts observing the new root.
//
// The event is not composed, so it only reaches listeners in the host's own
// tree. A host inside a closed root would otherwise be hidden from a listener
// on document, so the isolated world listens on each root it observes.
const attachShadow = Element.prototype.attachShadow

Element.prototype.attachShadow = function (
  this: Element,
  init: ShadowRootInit
): ShadowRoot {
  const root = attachShadow.call(this, init)
  this.dispatchEvent(new Event(SHADOW_ROOT_ATTACHED_EVENT, { bubbles: true }))
  return root
}
