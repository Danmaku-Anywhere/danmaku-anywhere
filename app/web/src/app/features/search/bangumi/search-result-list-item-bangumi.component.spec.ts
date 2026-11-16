import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { describe, expect, it } from 'vitest'
import type { LegacyBgmSubject } from '../../bangumi/types/bangumi.types'
import { BangumiSearchResultListItem } from './search-result-list-item-bangumi.component'

/**
 * The 64x96 search result thumbnail used to request the r/100 grid crop,
 * which blurs on a 2x screen. It now asks for the r/200 cover. These URLs
 * are the real v0 search API variants, where "medium" is 800px and "small"
 * is 200px, so the width in the URL has to drive the choice.
 */

const images = {
  large: 'https://lain.bgm.tv/pic/cover/l/4f/2f/299673_l8B8U.jpg',
  common: 'https://lain.bgm.tv/r/400/pic/cover/l/4f/2f/299673_l8B8U.jpg',
  medium: 'https://lain.bgm.tv/r/800/pic/cover/l/4f/2f/299673_l8B8U.jpg',
  small: 'https://lain.bgm.tv/r/200/pic/cover/l/4f/2f/299673_l8B8U.jpg',
  grid: 'https://lain.bgm.tv/r/100/pic/cover/l/4f/2f/299673_l8B8U.jpg',
}

const subject: LegacyBgmSubject = {
  id: 299673,
  type: 2,
  name: '転スラ日記 転生したらスライムだった件',
  name_cn: '转生史莱姆日记',
  summary: '',
  series: false,
  nsfw: false,
  locked: false,
  date: '2021-04-06',
  platform: 'TV',
  images,
  volumes: 0,
  eps: 12,
  total_episodes: 12,
  rating: { rank: 1, total: 1000, count: {}, score: 8.7 },
  collection: { wish: 0, collect: 0, doing: 0, on_hold: 0, dropped: 0 },
  meta_tags: ['TV'],
  tags: [],
}

@Component({
  imports: [BangumiSearchResultListItem],
  template: `<da-bangumi-search-result-list-item [subject]="subject" />`,
})
class Host {
  readonly subject = subject
}

function imageSrc() {
  TestBed.configureTestingModule({ imports: [Host] })
  const fixture = TestBed.createComponent(Host)
  fixture.detectChanges()
  return fixture.nativeElement.querySelector('img') as HTMLImageElement
}

describe('BangumiSearchResultListItem', () => {
  it('renders the 200px cover in the 64x96 slot instead of grid', () => {
    expect(imageSrc().getAttribute('src')).toBe(images.small)
  })
})
