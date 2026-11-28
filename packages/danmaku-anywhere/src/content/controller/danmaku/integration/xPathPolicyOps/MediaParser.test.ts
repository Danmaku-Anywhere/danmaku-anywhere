import { describe, expect, it } from 'vitest'
import { MediaParser, type MediaParserInput } from './MediaParser'

/**
 * The parser splits a page's title into the bare show title, the episode and
 * the season as it was written on the page. The season never stays inside
 * the title, whether it came from a named group, a separate element or a
 * heuristic scan of the title itself, and nothing is added for a show
 * without a season.
 */

const parser = new MediaParser()

const createInput = (
  title: string,
  regex: string[] = [],
  extras: Partial<Omit<MediaParserInput, 'title'>> = {}
): MediaParserInput => ({
  title: { value: title, regex },
  ...extras,
})

describe('MediaParser', () => {
  describe('Strategy: User Regex (Named Groups)', () => {
    it('should extract fields and respect user-defined title group', () => {
      const input = createInput('Attack on Titan S4E10 A Sound Argument', [
        '(?<title>.+) S(?<season>\\d+)E(?<episode>\\d+) (?<episodeTitle>.*)',
      ])

      expect(parser.parse(input)).toEqual({
        searchTitle: 'Attack on Titan',
        originalTitle: 'Attack on Titan S4E10 A Sound Argument',
        season: '4',
        episode: 10,
        episodeTitle: 'A Sound Argument',
      })
    })

    it('should keep the season out of the title when the regex splits them', () => {
      const input = createInput('进击的巨人 第四季 第10集', [
        '(?<title>.+) (?<season>第.+季) 第(?<episode>.+)集',
      ])

      expect(parser.parse(input)).toMatchObject({
        originalTitle: '进击的巨人 第四季 第10集',
        searchTitle: '进击的巨人',
        season: '第四季',
        episode: 10,
      })
    })

    it('should strip the season from a title group that still contains it', () => {
      const input = createInput('Attack on Titan S4E10', [
        '(?<title>.+ S(?<season>\\d+))E(?<episode>\\d+)',
      ])

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Attack on Titan',
        season: '4',
        episode: 10,
      })
    })

    it('should handle Chinese numerals in named groups', () => {
      const input = createInput('My Show 第三集', [
        '(?<title>.+) 第(?<episode>.+)集',
      ])

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'My Show',
        season: undefined,
        episode: 3,
      })
    })
  })

  describe('Strategy: Heuristics (Title Only)', () => {
    describe('English Patterns', () => {
      it('should handle standard SxxExx format', () => {
        const input = createInput('Breaking Bad S05E14 Ozymandias')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: 'Breaking Bad',
          season: 'S05',
          episode: 14,
        })
      })

      it('should handle "Season X Episode Y" format', () => {
        const input = createInput('The Office Season 2 Episode 5')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: 'The Office',
          season: 'Season 2',
          episode: 5,
        })
      })

      it('should handle implicit season (Episode only)', () => {
        const input = createInput('One Piece Episode 1000')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: 'One Piece',
          season: undefined,
          episode: 1000,
        })
      })

      it('should handle condensed SxE format', () => {
        const input = createInput('Arcane S2E1 Heavy Is The Crown')

        expect(parser.parse(input)).toMatchObject({
          originalTitle: 'Arcane S2E1 Heavy Is The Crown',
          searchTitle: 'Arcane',
          season: 'S2',
          episode: 1,
        })
      })

      it('should split a season with no episode', () => {
        const input = createInput('My Show Season 2')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: 'My Show',
          season: 'Season 2',
          episode: undefined,
        })
      })
    })

    describe('Chinese Patterns', () => {
      it('should parse "第X季 第Y集" format', () => {
        const input = createInput('鬼灭之刃 第3季 第5集')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: '鬼灭之刃',
          season: '第3季',
          episode: 5,
        })
      })

      it('should parse Chinese numerals (第x集)', () => {
        const input = createInput('进击的巨人 第二季 第十二集')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: '进击的巨人',
          season: '第二季',
          episode: 12,
        })
      })

      it('should handle combined season/episode', () => {
        const input = createInput('Overlord S4第02集')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: 'Overlord',
          season: 'S4',
          episode: 2,
        })
      })

      it('should split a season written without spaces', () => {
        const input = createInput('鬼灭之刃第3季第5集')

        expect(parser.parse(input)).toMatchObject({
          searchTitle: '鬼灭之刃',
          season: '第3季',
          episode: 5,
        })
      })
    })
  })

  describe('Strategy: Explicit Fields', () => {
    it('should use explicit season/episode over title heuristics', () => {
      const input = createInput('Attack On Titan', [], {
        season: { value: 'Season 5', regex: [] },
        episode: { value: '23', regex: [] },
      })

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Attack On Titan',
        season: 'Season 5',
        episode: 23,
      })
    })

    it('should keep the title bare with an explicit season', () => {
      const input = createInput('Stranger Things', [], {
        season: { value: 'S3', regex: [] },
      })

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Stranger Things',
        season: 'S3',
      })
    })

    it('should strip an explicit season that also sits in the title', () => {
      const input = createInput('Stranger Things S3', [], {
        season: { value: 'S3', regex: [] },
      })

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Stranger Things',
        season: 'S3',
      })
    })

    it('should strip a numeric season written as S<n> in the title', () => {
      const input = createInput('Stranger Things S3', [], {
        season: { value: '3', regex: [] },
      })

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Stranger Things',
        season: '3',
      })
    })

    it('should parse explicit elements using their own regex', () => {
      const input = createInput('Some Show', [], {
        season: { value: 'Season: 04', regex: ['Season: (?<season>\\d+)'] },
        episode: { value: 'Ep: 12', regex: ['Ep: (?<episode>\\d+)'] },
      })

      expect(parser.parse(input)).toMatchObject({
        episode: 12,
        searchTitle: 'Some Show',
        season: '04',
      })
    })
  })

  describe('Normalization & Edge Cases', () => {
    it('should ignore brackets/tags at start of file if episode is elsewhere', () => {
      const input = createInput('[FansubGroup] Narouto S1E05 [1080p]')

      expect(parser.parse(input)).toMatchObject({
        searchTitle: '[FansubGroup] Narouto',
        season: 'S1',
        episode: 5,
      })
    })

    it('should return defaults if nothing found', () => {
      const input = createInput('Just A Movie Title')

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Just A Movie Title',
        season: undefined,
        episode: undefined,
      })
    })

    it('should handle complex episode titles that contain numbers', () => {
      const input = createInput('Space Odyssey S1E5 A Space Odyssey 2001')

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Space Odyssey',
        season: 'S1',
        episode: 5,
      })
    })

    it('should not strip a season token that is part of a word', () => {
      const input = createInput('GS2 Show', [], {
        season: { value: 'S2', regex: [] },
      })

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'GS2 Show',
        season: 'S2',
      })
    })
  })

  describe('Separators before the episode', () => {
    it.each(['·', '•', '・', '-', '–', '|', '｜', '.', ':', '：'])(
      'should drop a trailing "%s" left by truncating at the episode',
      (separator) => {
        const input = createInput(`Show S2 ${separator} E3`)

        expect(parser.parse(input)).toMatchObject({
          searchTitle: 'Show',
          season: 'S2',
          episode: 3,
        })
      }
    )

    it('should drop a trailing separator before a Chinese episode marker', () => {
      const input = createInput('进击的巨人 - 第3集')

      expect(parser.parse(input)).toMatchObject({
        searchTitle: '进击的巨人',
        episode: 3,
      })
    })

    it('should drop the separator and keep an explicit season as its own field', () => {
      const input = createInput('Show · E3', [], {
        season: { value: 'S2', regex: [] },
      })

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Show',
        season: 'S2',
        episode: 3,
      })
    })

    it('should drop a separator that only the season was holding off', () => {
      const input = createInput('Show - S2 - E3')

      expect(parser.parse(input)).toMatchObject({
        searchTitle: 'Show',
        season: 'S2',
        episode: 3,
      })
    })

    it.each([
      ['K-On! S1E5', 'K-On!'],
      ['Re:Zero S2E1', 'Re:Zero'],
      ['Dr. Stone S1E1', 'Dr. Stone'],
      ['Steins;Gate 0 E1', 'Steins;Gate 0'],
    ])('should keep punctuation inside the title: %s', (title, expected) => {
      expect(parser.parse(createInput(title))).toMatchObject({
        searchTitle: expected,
      })
    })
  })
})
