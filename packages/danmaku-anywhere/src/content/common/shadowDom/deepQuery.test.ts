import { afterEach, describe, expect, it } from 'vitest'
import { containsComposed, queryAllDeep } from './deepQuery'

function hostWith(...children: Node[]): HTMLElement {
  const host = document.createElement('div')
  host.attachShadow({ mode: 'open' }).append(...children)
  return host
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('queryAllDeep', () => {
  it('matches in the light DOM and in nested open shadow roots', () => {
    const light = document.createElement('video')
    const shallow = document.createElement('video')
    const deep = document.createElement('video')
    const inner = hostWith(deep)
    const outer = hostWith(shallow, inner)
    document.body.append(light, outer)

    const { matches, shadowRoots } = queryAllDeep(document, 'video')

    expect(matches).toEqual([light, shallow, deep])
    expect(shadowRoots).toEqual([outer.shadowRoot, inner.shadowRoot])
  })

  it('matches the scope element itself and searches its own shadow root', () => {
    const video = document.createElement('video')
    const host = hostWith(video)

    expect(queryAllDeep(host, 'video').matches).toEqual([video])
    expect(queryAllDeep(video, 'video').matches).toEqual([video])
  })

  it('skips the shadow roots of filtered hosts', () => {
    const host = hostWith(document.createElement('video'))
    document.body.append(host)

    const { matches, shadowRoots } = queryAllDeep(
      document,
      'video',
      (h) => h === host
    )

    expect(matches).toEqual([])
    expect(shadowRoots).toEqual([])
  })
})

describe('containsComposed', () => {
  it('sees through shadow boundaries but not into unrelated trees', () => {
    const video = document.createElement('video')
    const inner = hostWith(video)
    const outer = hostWith(inner)
    const wrapper = document.createElement('section')
    wrapper.append(outer)
    const sibling = document.createElement('section')
    document.body.append(wrapper, sibling)

    expect(containsComposed(wrapper, video)).toBe(true)
    expect(containsComposed(outer, video)).toBe(true)
    expect(containsComposed(sibling, video)).toBe(false)
  })
})
