import type { Season } from '@danmaku-anywhere/danmaku-model'
import { inject, injectable } from 'inversify'
import { SeasonService } from '@/background/services/persistence/SeasonService'
import { TitleMappingService } from '@/background/services/persistence/TitleMappingService'
import type { MatchEpisodeInput, MatchEpisodeResult } from '@/common/anime/dto'
import { parseSeasonNumber, rankBySeason } from '@/common/anime/seasonRank'
import { isCustomSeason } from '@/common/danmaku/utils'
import { type ILogger, LoggerSymbol } from '@/common/Logger'
import { SeasonMap } from '@/common/seasonMap/SeasonMap'
import { serializeError } from '@/common/utils/serializeError'
import { SourceCapabilityService } from '../../providers/SourceCapabilityService'
import { EpisodeResolutionService } from '../EpisodeResolutionService'
import type { IMatchingStrategy } from './IMatchingStrategy'

@injectable()
export class SearchMatchingStrategy implements IMatchingStrategy {
  readonly name = 'search'

  private logger: ILogger

  constructor(
    @inject(SourceCapabilityService)
    private sourceCapabilities: SourceCapabilityService,
    @inject(SeasonService) private seasonService: SeasonService,
    @inject(TitleMappingService)
    private titleMappingService: TitleMappingService,
    @inject(EpisodeResolutionService)
    private episodeResolver: EpisodeResolutionService,
    @inject(LoggerSymbol) logger: ILogger
  ) {
    this.logger = logger.sub('SearchStrategy')
  }

  async match(input: MatchEpisodeInput): Promise<MatchEpisodeResult | null> {
    const { title, mapKey, episodeNumber, seasonDecorator } = input

    const autoProvider =
      await this.sourceCapabilities.getFirstSearchMatchProvider()

    if (!autoProvider) {
      return null
    }

    const service = await this.sourceCapabilities.searchProvider(autoProvider)
    if (service.kind === 'searchOnly') {
      return null
    }

    this.logger.debug(`Searching for season: ${title}`)
    const foundSeasonInserts = await service.search({ keyword: title })

    const foundSeasons = await this.seasonService.bulkUpsert(foundSeasonInserts)

    if (foundSeasons.length === 0) {
      return { status: 'notFound', data: null, cause: 'No seasons found' }
    }

    const { chosen, ordered } = this.pickBySeason(foundSeasons, seasonDecorator)

    if (chosen) {
      this.logger.debug('Single season found, auto-mapping', chosen)

      await this.titleMappingService.add(SeasonMap.fromSeason(mapKey, chosen))

      if (episodeNumber === undefined) {
        return {
          status: 'notFound',
          data: null,
          cause: 'Episode number is undefined',
        }
      }

      try {
        const data = await this.episodeResolver.resolveEpisode(
          chosen,
          episodeNumber
        )
        return {
          status: 'success',
          data,
          metadata: { strategy: 'search', providerConfig: autoProvider },
        }
      } catch (e) {
        return {
          status: 'notFound',
          data: null,
          cause: serializeError(e).message,
        }
      }
    }

    return {
      status: 'disambiguation',
      data: ordered.filter((s) => !isCustomSeason(s)),
      metadata: { strategy: 'search', providerConfig: autoProvider },
    }
  }

  private pickBySeason(
    foundSeasons: Season[],
    seasonDecorator: string | undefined
  ): { chosen: Season | undefined; ordered: Season[] } {
    const wanted =
      seasonDecorator === undefined ? null : parseSeasonNumber(seasonDecorator)

    if (wanted === null) {
      return {
        chosen: foundSeasons.length === 1 ? foundSeasons[0] : undefined,
        ordered: foundSeasons,
      }
    }

    const { matches, others } = rankBySeason(foundSeasons, wanted)
    this.logger.debug(`Season ${wanted}: ${matches.length} results match`)
    return {
      chosen: matches.length === 1 ? matches[0] : undefined,
      ordered: [...matches, ...others],
    }
  }
}
