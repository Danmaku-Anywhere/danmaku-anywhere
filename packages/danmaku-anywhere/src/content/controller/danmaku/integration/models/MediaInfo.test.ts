import { describe, expect, it } from 'vitest'
import { MediaInfo } from './MediaInfo'

/**
 * The title mapping key stays what it was when the season was still appended
 * to the title: the bare title followed by the season as S<n> for a numeric
 * decorator and verbatim otherwise, so mappings saved by earlier versions keep
 * resolving.
 */

describe('MediaInfo.getKey', () => {
  it('is the trimmed title when there is no season', () => {
    expect(new MediaInfo({ title: ' Just A Movie ' }).getKey()).toBe(
      'Just A Movie'
    )
  })

  it.each([
    ['Attack on Titan', '4', 'Attack on Titan S4'],
    ['Some Show', '04', 'Some Show S4'],
    ['Stranger Things', 'S3', 'Stranger Things S3'],
    ['Breaking Bad', 'S05', 'Breaking Bad S05'],
    ['The Office', 'Season 2', 'The Office Season 2'],
    ['进击的巨人', '第四季', '进击的巨人 第四季'],
    ['鬼灭之刃', '第3季', '鬼灭之刃 第3季'],
    ['我的动画', ' 第二季 ', '我的动画 第二季'],
  ])('keys %s with season %s as %s', (title, seasonDecorator, key) => {
    expect(new MediaInfo({ title, seasonDecorator }).getKey()).toBe(key)
  })
})
