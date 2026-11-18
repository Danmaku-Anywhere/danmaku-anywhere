import { chineseToNumber } from '@/common/utils/chineseToNumber'
import { mediaRegexMatcher } from './mediaRegexMatcher'
import type { ExtractorMatch, MediaInfoParseResult } from './types'

interface ParserInputField {
  value: string
  regex: string[]
}

export interface MediaParserInput {
  title: ParserInputField
  season?: ParserInputField | null
  episode?: ParserInputField | null
  episodeTitle?: ParserInputField | null
}

class ParsingContext {
  searchTitle: string
  originalTitle: string

  result: {
    season?: string
    episode?: number
    episodeTitle?: string
  } = {}

  episodeMatchIndex: number | null = null

  constructor(originalTitle: string) {
    this.originalTitle = originalTitle
    this.searchTitle = this.originalTitle
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function seasonTokens(season: string): string[] {
  const tokens = [season.trim()]
  const numericSeason = chineseToNumber(season)
  if (numericSeason !== null) {
    tokens.push(`S${numericSeason}`)
  }
  return tokens
}

// Removes the season from the title when it is written there as its own
// token, so "GS2 Show" keeps its S2 while "Show S2" loses it.
function stripSeason(title: string, season: string): string {
  for (const token of seasonTokens(season)) {
    if (!token) {
      continue
    }
    const pattern = new RegExp(
      `(?<![A-Za-z0-9])${escapeRegex(token)}(?![A-Za-z0-9])`,
      'i'
    )
    if (pattern.test(title)) {
      return title.replace(pattern, ' ')
    }
  }
  return title
}

function coerceToNumber(val: string | number): number {
  if (typeof val === 'number') {
    return val
  }
  return chineseToNumber(val) ?? Number.parseInt(val, 10)
}

export class MediaParser {
  public parse(input: MediaParserInput): MediaInfoParseResult {
    const context = new ParsingContext(input.title.value)

    // Try parsing using regex with named groups
    if (this.tryApplyNamedGroups(context, input.title.regex)) {
      return this.finalize(context)
    }

    // Try parsing each field explicitly
    if (input.season) {
      const match = this.extractField(
        input.season.value,
        input.season.regex,
        'season'
      )

      context.result.season = match
        ? match.value.toString()
        : input.season.value
    }

    if (input.episode) {
      const match = this.extractField(
        input.episode.value,
        input.episode.regex,
        'episode'
      )
      if (match) {
        context.result.episode = coerceToNumber(match.value)
      } else {
        const numericEpisode = chineseToNumber(input.episode.value)
        if (numericEpisode) {
          context.result.episode = numericEpisode
        }
      }
    }

    if (input.episodeTitle) {
      context.result.episodeTitle = input.episodeTitle.value
    }

    this.scanTitleForMissingInfo(context, input)

    this.rebuildSearchTitle(context)

    return this.finalize(context)
  }

  private tryApplyNamedGroups(ctx: ParsingContext, regexes: string[]): boolean {
    if (!regexes || regexes.length === 0) return false

    const match = mediaRegexMatcher.runUserRegex(ctx.originalTitle, regexes)

    if (match && match.groups) {
      const g = match.groups

      if (g.title) {
        ctx.searchTitle = g.title.trim()

        if (g.season) {
          ctx.result.season = g.season
        }
        if (g.episode) {
          ctx.result.episode = coerceToNumber(g.episode)
        }
        if (g.episodeTitle) {
          ctx.result.episodeTitle = g.episodeTitle.trim()
        }

        this.rebuildSearchTitle(ctx)

        return true
      }
    }

    return false
  }

  private scanTitleForMissingInfo(
    ctx: ParsingContext,
    input: MediaParserInput
  ) {
    // Look for episode
    if (ctx.result.episode === undefined) {
      const match = this.extractField(
        ctx.originalTitle,
        input.episode?.regex ?? [],
        'episode'
      )
      if (match) {
        ctx.result.episode = coerceToNumber(match.value)
        ctx.episodeMatchIndex = match.index

        // Check if the match contains a season identifier
        const combinedSeasonMatch = match.raw.match(
          /^(S\d+|Season\s?\d+|第.+季)/i
        )
        if (combinedSeasonMatch && !ctx.result.season) {
          ctx.result.season = combinedSeasonMatch[0]
        }
      }
    }

    // Look for season if missing
    if (ctx.result.season === undefined) {
      const match = this.extractField(
        ctx.originalTitle,
        input.season?.regex ?? [],
        'season'
      )
      if (match) {
        ctx.result.season = match.raw
      } else if (ctx.episodeMatchIndex !== null) {
        // "S2E05" and "S4第02集" glue the season onto the episode, where the
        // common season patterns do not reach
        const gluedSeason = ctx.originalTitle
          .substring(0, ctx.episodeMatchIndex)
          .match(/(?:^|\s)(S\d+)$/i)
        if (gluedSeason) {
          ctx.result.season = gluedSeason[1]
        }
      }
    }
  }

  private rebuildSearchTitle(ctx: ParsingContext) {
    // Truncate the title at the episode match index
    if (ctx.episodeMatchIndex !== null && ctx.episodeMatchIndex >= 0) {
      ctx.searchTitle = ctx.originalTitle.substring(0, ctx.episodeMatchIndex)
    }

    if (ctx.result.season) {
      ctx.searchTitle = stripSeason(ctx.searchTitle, ctx.result.season)
    }

    // Remove double spaces
    ctx.searchTitle = ctx.searchTitle.replace(/\s+/g, ' ').trim()
  }

  private extractField(
    text: string,
    userRegex: string[],
    type: 'season' | 'episode'
  ): ExtractorMatch | null {
    if (userRegex.length > 0) {
      const match = mediaRegexMatcher.runUserRegex(text, userRegex)
      if (match) {
        return match
      }
    }

    return type === 'season'
      ? mediaRegexMatcher.findCommonSeason(text)
      : mediaRegexMatcher.findCommonEpisode(text)
  }

  private finalize(ctx: ParsingContext): MediaInfoParseResult {
    return {
      searchTitle: ctx.searchTitle,
      originalTitle: ctx.originalTitle,
      season: ctx.result.season,
      episode: ctx.result.episode,
      episodeTitle: ctx.result.episodeTitle,
    }
  }
}
