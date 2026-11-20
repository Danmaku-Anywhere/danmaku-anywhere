import { shadowRootOf } from './shadowRootOf'

export type ShadowHostFilter = (host: Element) => boolean

export interface DeepQueryResult<T extends Element> {
  matches: T[]
  shadowRoots: ShadowRoot[]
}

type QueryScope = Element | ShadowRoot | Document

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

function ownerDocumentOf(scope: QueryScope): Document {
  return scope.ownerDocument ?? (scope as Document)
}

function collectFrom<T extends Element>(
  scope: QueryScope,
  selector: string,
  skipHost: ShadowHostFilter,
  result: DeepQueryResult<T>
): void {
  const hosts: Element[] = []
  if (isElement(scope)) {
    if (scope.matches(selector)) {
      result.matches.push(scope as T)
    }
    hosts.push(scope)
  }
  result.matches.push(...scope.querySelectorAll<T>(selector))

  const walker = ownerDocumentOf(scope).createTreeWalker(
    scope,
    NodeFilter.SHOW_ELEMENT
  )
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    hosts.push(node as Element)
  }

  for (const host of hosts) {
    const root = shadowRootOf(host)
    if (!root || skipHost(host)) {
      continue
    }
    result.shadowRoots.push(root)
    collectFrom(root, selector, skipHost, result)
  }
}

/**
 * Like querySelectorAll, but also searches every shadow root under `scope`
 * that shadowRootOf can reach, at any depth. The selector is matched inside
 * each root on its own, so it cannot span a shadow boundary. An element scope
 * is matched against the selector itself as well, and its own shadow root is
 * searched.
 */
export function queryAllDeep<T extends Element>(
  scope: QueryScope,
  selector: string,
  skipHost: ShadowHostFilter = () => false
): DeepQueryResult<T> {
  const result: DeepQueryResult<T> = { matches: [], shadowRoots: [] }
  collectFrom(scope, selector, skipHost, result)
  return result
}

/** Node.contains that also looks through the shadow roots `node` sits in. */
export function containsComposed(ancestor: Node, node: Node): boolean {
  let current: Node | null = node
  while (current) {
    if (ancestor.contains(current)) {
      return true
    }
    const root = current.getRootNode() as Node & { host?: Element }
    current = root.host ?? null
  }
  return false
}
