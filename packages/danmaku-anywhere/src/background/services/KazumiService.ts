import type {
  KazumiChapterResult,
  KazumiPolicy,
  KazumiSearchResult,
} from '@danmaku-anywhere/extension-protocol'
import {
  type KazumiApiOptions,
  kazumiGetChapters,
  kazumiSearch,
} from '@danmaku-anywhere/web-scraper'
import { injectable } from 'inversify'
import { setSessionHeader } from '@/background/netRequest/setSessionHeader'

const apiOptions: KazumiApiOptions = { setSessionHeader }

@injectable('Singleton')
export class KazumiService {
  async searchContent(
    keyword: string,
    policy: KazumiPolicy
  ): Promise<KazumiSearchResult[]> {
    return kazumiSearch(keyword, policy, apiOptions)
  }

  async getChapters(
    contentUrl: string,
    policy: KazumiPolicy
  ): Promise<KazumiChapterResult[][]> {
    return kazumiGetChapters(contentUrl, policy, apiOptions)
  }
}
