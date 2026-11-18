import { chineseToNumber } from '@/common/utils/chineseToNumber'

const CN_NUMERAL_CLASS =
  '[零一二三四五六七八九十百千万萬两兩壹贰貳叁參弎肆伍陆陸柒捌玖拾佰仟]'

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
}

// Single-letter numerals (V, X) are left out: they are far more often a
// word in a title than a season.
const ROMAN_NUMERALS: Record<string, number> = {
  II: 2,
  III: 3,
  IV: 4,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  Ⅱ: 2,
  Ⅲ: 3,
  Ⅳ: 4,
  Ⅴ: 5,
  Ⅵ: 6,
  Ⅶ: 7,
  Ⅷ: 8,
  Ⅸ: 9,
  Ⅹ: 10,
}

interface SeasonPattern {
  regex: RegExp
  toNumber: (captured: string) => number | null
}

function decimal(captured: string): number | null {
  const value = Number.parseInt(captured, 10)
  return Number.isNaN(value) ? null : value
}

const SEASON_PATTERNS: SeasonPattern[] = [
  { regex: /^\d{1,2}$/, toNumber: decimal },
  { regex: /(?:^|\s)S(\d{1,2})(?=$|\s|E\d)/i, toNumber: decimal },
  { regex: /(?:^|\s)Season\s*(\d{1,2})(?=$|\s|\W)/i, toNumber: decimal },
  {
    regex: /(?:^|\s)(\d{1,2})(?:st|nd|rd|th)\s+Season(?=$|\s|\W)/i,
    toNumber: decimal,
  },
  {
    regex:
      /(?:^|\s)(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+Season(?=$|\s|\W)/i,
    toNumber: (word) => ORDINAL_WORDS[word.toLowerCase()] ?? null,
  },
  {
    regex: new RegExp(`第\\s*(\\d{1,2}|${CN_NUMERAL_CLASS}+)\\s*[季期]`),
    toNumber: chineseToNumber,
  },
  {
    regex: /(?:^|\s)(II|III|IV|VI|VII|VIII|IX|[ⅡⅢⅣⅤⅥⅦⅧⅨⅩ])(?=$|\s|[:：])/,
    toNumber: (numeral) => ROMAN_NUMERALS[numeral] ?? null,
  },
]

/**
 * Reads a season number out of a show title or a season decorator such as
 * "S2", "Season 2", "2nd Season", "第二季" or a bare "2". Null when the text
 * carries no season.
 */
export function parseSeasonNumber(text: string): number | null {
  const trimmed = text.trim()
  for (const { regex, toNumber } of SEASON_PATTERNS) {
    const match = regex.exec(trimmed)
    if (match) {
      const value = toNumber(match[1] ?? match[0])
      if (value !== null) {
        return value
      }
    }
  }
  return null
}

interface TitledSeason {
  title: string
  alternativeTitles?: string[]
}

export interface SeasonRanking<T> {
  matches: T[]
  others: T[]
}

/** The season a result is on, read from its titles; 1 when none names one. */
export function seasonNumberOf(season: TitledSeason): number {
  for (const title of [season.title, ...(season.alternativeTitles ?? [])]) {
    const value = parseSeasonNumber(title)
    if (value !== null) {
      return value
    }
  }
  return 1
}

/**
 * Splits search results into the ones on the wanted season and the rest,
 * both in their original order. A result whose titles name no season is
 * taken to be the first season.
 */
export function rankBySeason<T extends TitledSeason>(
  seasons: T[],
  wanted: number
): SeasonRanking<T> {
  const matches: T[] = []
  const others: T[] = []
  for (const season of seasons) {
    if (seasonNumberOf(season) === wanted) {
      matches.push(season)
    } else {
      others.push(season)
    }
  }
  return { matches, others }
}
