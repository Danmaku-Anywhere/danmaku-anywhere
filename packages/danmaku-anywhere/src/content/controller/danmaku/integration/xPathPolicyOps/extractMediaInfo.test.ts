import { describe, expect, it } from 'vitest'
import type { IntegrationPolicy } from '@/common/options/integrationPolicyStore/schema'
import { extractMediaInfo } from './extractMediaInfo'

/**
 * Media info built from matched page elements keeps the show title bare and
 * carries the season as its own decorator. The mapping key still reads as the
 * title with the season appended, exactly as earlier versions produced it.
 */

function mockElement(text: string | undefined): Node | null {
  if (text === undefined) {
    return null
  }
  return { textContent: text } as Node
}

function createMediaElements({
  title,
  season,
  episode,
  episodeTitle,
}: {
  title: string
  season?: string
  episode?: string
  episodeTitle?: string
}): {
  title: Node
  season: Node | null
  episode: Node | null
  episodeTitle: Node | null
} {
  return {
    title: mockElement(title) as Node,
    season: mockElement(season),
    episode: mockElement(episode),
    episodeTitle: mockElement(episodeTitle),
  }
}

function mockPolicy(
  overrides: Partial<IntegrationPolicy> = {}
): IntegrationPolicy {
  return {
    version: 3,
    options: {},
    title: { regex: [], selector: [] },
    season: { regex: [], selector: [] },
    episode: { regex: [], selector: [] },
    episodeTitle: { regex: [], selector: [] },
    ...overrides,
  }
}

function extract(elements: ReturnType<typeof createMediaElements>) {
  const result = extractMediaInfo(elements, mockPolicy())
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.mediaInfo
}

describe('extractMediaInfo', () => {
  it('keeps a separate season out of the title', () => {
    const mediaInfo = extract(
      createMediaElements({ title: 'My Show', season: 'S2', episode: 'E5' })
    )

    expect(mediaInfo.title).toBe('My Show')
    expect(mediaInfo.seasonDecorator).toBe('S2')
    expect(mediaInfo.episode).toBe(5)
    expect(mediaInfo.getKey()).toBe('My Show S2')
  })

  it('strips a season that is already in the title', () => {
    const mediaInfo = extract(
      createMediaElements({ title: 'My Show S2', season: 'S2' })
    )

    expect(mediaInfo.title).toBe('My Show')
    expect(mediaInfo.seasonDecorator).toBe('S2')
    expect(mediaInfo.getKey()).toBe('My Show S2')
  })

  it('handles a Chinese season', () => {
    const mediaInfo = extract(
      createMediaElements({ title: '我的动画', season: '第二季' })
    )

    expect(mediaInfo.title).toBe('我的动画')
    expect(mediaInfo.seasonDecorator).toBe('第二季')
    expect(mediaInfo.getKey()).toBe('我的动画 第二季')
  })

  it('leaves the decorator unset for a show without a season', () => {
    const mediaInfo = extract(
      createMediaElements({ title: 'Show', episode: 'Episode 12' })
    )

    expect(mediaInfo.title).toBe('Show')
    expect(mediaInfo.seasonDecorator).toBe(undefined)
    expect(mediaInfo.episode).toBe(12)
    expect(mediaInfo.getKey()).toBe('Show')
  })
})
