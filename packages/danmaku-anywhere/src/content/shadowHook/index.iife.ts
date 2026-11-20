import { SHADOW_ROOT_ATTACHED_EVENT } from '@/content/common/shadowDom/shadowRootAttachedEvent'

// Runs in the page's main world so it sees the page's own attachShadow calls,
// which produce no DOM mutation. The player script in the isolated world
// listens for the event and starts observing the new root.
//
// The event is not composed, so it only reaches listeners in the host's own
// tree. A host inside a closed root would otherwise be hidden from a listener
// on document, so the isolated world listens on each root it observes.
//
// Event and dispatchEvent are captured up front, and a failed announcement is
// swallowed, so the page's attachShadow behaves the same whatever the page
// does to those globals later.
const attachShadow = Element.prototype.attachShadow
const dispatchEvent = EventTarget.prototype.dispatchEvent
const PageEvent = Event

Element.prototype.attachShadow = function (
  this: Element,
  init: ShadowRootInit
): ShadowRoot {
  const root = attachShadow.call(this, init)
  try {
    dispatchEvent.call(
      this,
      new PageEvent(SHADOW_ROOT_ATTACHED_EVENT, { bubbles: true })
    )
  } catch {
    // the root is attached either way
  }
  return root
}
