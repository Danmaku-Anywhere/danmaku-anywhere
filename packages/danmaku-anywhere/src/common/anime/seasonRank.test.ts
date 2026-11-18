import { describe, expect, it } from 'vitest'
import { parseSeasonNumber, rankBySeason } from './seasonRank'

/**
 * Season numbers read out of show titles and the decorator the page parser
 * hands over, in the formats DanDanPlay and video sites use: S2, Season 2,
 * 2nd Season, 第二季, 第2季 and a trailing Roman numeral. Ranking splits
 * search results into the ones on the wanted season and the rest, where a
 * title with no season marker counts as season 1.
 */

describe('parseSeasonNumber', () => {
  it.each([
    ['Show S2', 2],
    ['Show S02', 2],
    ['Show S2E05', 2],
    ['Show Season 2', 2],
    ['Show Season2', 2],
    ['Show season 10', 10],
    ['Mushoku Tensei 2nd Season', 2],
    ['Spy x Family 3rd Season', 3],
    ['Show 1st Season', 1],
    ['Show Second Season', 2],
    ['进击的巨人 第二季', 2],
    ['鬼灭之刃 第3季', 3],
    ['我的动画 第叁季', 3],
    ['Re:ゼロ 第2期', 2],
    ['Overlord II', 2],
    ['Overlord Ⅲ', 3],
    ['Spy x Family Season 2 Part 2', 2],
    ['S05', 5],
    ['第四季', 4],
    ['4', 4],
  ])('reads %s as season %i', (text, expected) => {
    expect(parseSeasonNumber(text)).toBe(expected)
  })

  it.each([
    'Show',
    'Hunter X Hunter',
    'Gundam V',
    'DNS1',
    'TheSeason1',
    'Steins;Gate 0',
    'Show S2000',
    'Mobile Suit Gundam 2001',
    '',
  ])('reads no season out of %s', (text) => {
    expect(parseSeasonNumber(text)).toBe(null)
  })
})

describe('rankBySeason', () => {
  const show = { title: 'Show' }
  const second = { title: 'Show 第二季' }
  const secondEn = { title: 'Show Season 2' }
  const third = { title: 'Show 3rd Season' }
  const altOnly = {
    title: '進撃の巨人',
    alternativeTitles: ['进击的巨人 第二季'],
  }

  it('puts results on the wanted season first and keeps the rest in order', () => {
    expect(rankBySeason([show, third, second, secondEn], 2)).toEqual({
      matches: [second, secondEn],
      others: [show, third],
    })
  })

  it('treats a title without a season marker as season 1', () => {
    expect(rankBySeason([second, show, third], 1)).toEqual({
      matches: [show],
      others: [second, third],
    })
  })

  it('reads the season from an alternative title when the title has none', () => {
    expect(rankBySeason([show, altOnly], 2)).toEqual({
      matches: [altOnly],
      others: [show],
    })
  })

  it('matches nothing when no result is on the wanted season', () => {
    expect(rankBySeason([show, second], 4)).toEqual({
      matches: [],
      others: [show, second],
    })
  })
})
