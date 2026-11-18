import type { Season, SeasonInsert } from '@danmaku-anywhere/danmaku-model'
import { describe, expect, it, vi } from 'vitest'
import { backgroundContainerModule } from '@/background/ioc'
import { SeasonService } from '@/background/services/persistence/SeasonService'
import { TitleMappingService } from '@/background/services/persistence/TitleMappingService'
import { SourceCapabilityService } from '@/background/services/providers/SourceCapabilityService'
import type { MatchEpisodeInput } from '@/common/anime/dto'
import { LoggerSymbol } from '@/common/Logger'
import type { SeasonMap } from '@/common/seasonMap/SeasonMap'
import { createTestContainer } from '@/tests/createTestContainer'
import { makeProviderConfig, makeSeasonInsert } from '@/tests/factories'
import { silentLogger } from '@/tests/silentLogger'
import { EpisodeResolutionService } from '../EpisodeResolutionService'
import { SearchMatchingStrategy } from './SearchMatchingStrategy'

/**
 * Search matching sends the bare show title as the keyword and uses the
 * season the page parser found to pick among the results: exactly one result
 * on that season is mapped and resolved, otherwise the user disambiguates with
 * the season's results listed first. Without a season the single-result
 * auto-map behaves as before.
 */

const providerConfig = makeProviderConfig()

function insert(title: string, alternativeTitles?: string[]): SeasonInsert {
  return makeSeasonInsert({ title, indexedId: title, alternativeTitles })
}

function build(results: SeasonInsert[]) {
  const search = vi.fn(async () => results)
  const add = vi.fn(async (_map: SeasonMap) => undefined)
  const resolveEpisode = vi.fn(async (season: Season, episode: number) => ({
    title: `${season.title} ${episode}`,
    season,
  }))

  const sourceCapabilities = {
    getFirstSearchMatchProvider: async () => providerConfig,
    searchProvider: async () => ({ kind: 'source', search }),
  }
  const seasonService = {
    bulkUpsert: async (inserts: SeasonInsert[]) =>
      inserts.map((item, index) => ({
        ...item,
        id: index + 1,
        version: 1,
        timeUpdated: 0,
      })),
  }
  const episodeResolver = { resolveEpisode }

  const strategy = createTestContainer(
    [backgroundContainerModule],
    [
      { identifier: SourceCapabilityService, value: sourceCapabilities },
      { identifier: SeasonService, value: seasonService },
      { identifier: TitleMappingService, value: { add } },
      { identifier: EpisodeResolutionService, value: episodeResolver },
      { identifier: LoggerSymbol, value: silentLogger },
    ]
  ).get(SearchMatchingStrategy)
  return { strategy, search, add, resolveEpisode }
}

function input(overrides: Partial<MatchEpisodeInput> = {}): MatchEpisodeInput {
  return {
    mapKey: 'Show S2',
    title: 'Show',
    episodeNumber: 3,
    seasonDecorator: 'S2',
    ...overrides,
  }
}

function titles(result: Awaited<ReturnType<SearchMatchingStrategy['match']>>) {
  if (result?.status !== 'disambiguation') {
    throw new Error(`expected disambiguation, got ${result?.status}`)
  }
  return result.data.map((season) => season.title)
}

describe('SearchMatchingStrategy', () => {
  it('searches with the bare title, never a season suffix', async () => {
    const { strategy, search } = build([insert('Show 第二季')])

    await strategy.match(input())

    expect(search).toHaveBeenCalledWith({ keyword: 'Show' })
  })

  it('maps and resolves the only result on the wanted season', async () => {
    const { strategy, add, resolveEpisode } = build([
      insert('Show'),
      insert('Show 第二季'),
      insert('Show 3rd Season'),
    ])

    const result = await strategy.match(input())

    expect(result?.status).toBe('success')
    expect(add).toHaveBeenCalledTimes(1)
    expect(add.mock.calls[0][0]).toMatchObject({ key: 'Show S2' })
    expect(resolveEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Show 第二季' }),
      3
    )
  })

  it('reads the season from an alternative title', async () => {
    const { strategy, resolveEpisode } = build([
      insert('Show'),
      insert('進撃の巨人', ['进击的巨人 第二季']),
    ])

    const result = await strategy.match(input())

    expect(result?.status).toBe('success')
    expect(resolveEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ title: '進撃の巨人' }),
      3
    )
  })

  it('disambiguates with the wanted season first when several match', async () => {
    const { strategy, add } = build([
      insert('Show'),
      insert('Show Season 2'),
      insert('Show 3rd Season'),
      insert('Show 第二季'),
    ])

    const result = await strategy.match(input())

    expect(titles(result)).toEqual([
      'Show Season 2',
      'Show 第二季',
      'Show',
      'Show 3rd Season',
    ])
    expect(add).not.toHaveBeenCalled()
  })

  it('disambiguates when no result is on the wanted season, even a single one', async () => {
    const { strategy, add } = build([insert('Show')])

    const result = await strategy.match(input({ seasonDecorator: '第四季' }))

    expect(titles(result)).toEqual(['Show'])
    expect(add).not.toHaveBeenCalled()
  })

  it('counts a result without a season marker as season 1', async () => {
    const { strategy, resolveEpisode } = build([
      insert('Show 第二季'),
      insert('Show'),
    ])

    const result = await strategy.match(input({ seasonDecorator: 'S1' }))

    expect(result?.status).toBe('success')
    expect(resolveEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Show' }),
      3
    )
  })

  it('auto-maps a single result when the page has no season', async () => {
    const { strategy, resolveEpisode } = build([insert('Show 第二季')])

    const result = await strategy.match(
      input({ seasonDecorator: undefined, mapKey: 'Show' })
    )

    expect(result?.status).toBe('success')
    expect(resolveEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Show 第二季' }),
      3
    )
  })

  it('disambiguates several results when the page has no season', async () => {
    const { strategy } = build([insert('Show'), insert('Show 第二季')])

    const result = await strategy.match(
      input({ seasonDecorator: undefined, mapKey: 'Show' })
    )

    expect(titles(result)).toEqual(['Show', 'Show 第二季'])
  })

  it('reports notFound when the search returns nothing', async () => {
    const { strategy } = build([])

    const result = await strategy.match(input())

    expect(result).toMatchObject({ status: 'notFound' })
  })
})
