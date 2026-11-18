import type { BrowserContext, Page, Route } from '@playwright/test'
import { IntegrationPage } from '../../pom/IntegrationPage'
import { Toast } from '../../pom/Toast'
import type { DaClient } from '../../setup/da-client'
import { expect, test } from '../../setup/fixtures'
import { loadJsonFixture } from '../../setup/fixtures-loader'
import {
  buildFixtureIntegrationPolicy,
  seedXPathIntegration,
} from '../../setup/integration'
import { applyProfile } from '../../setup/profile'

/**
 * A page showing the season apart from the title is matched by searching the
 * bare title and letting the season pick the result; DanDanPlay answers only
 * the bare keyword here. One result on season 2 mounts on its own and the
 * toast names it; two results on season 2 open the selector with both listed
 * ahead of the other seasons. Asserts toast text and the selector's card order.
 */

const ORIGIN = 'https://da-test.invalid'
const NATIVE_URL = `${ORIGIN}/native/`
const MOUNT_PATTERN = `${ORIGIN}/*`
const SHOW = 'DA Integration Test'

const DDP_SEARCH_URL = /\/ddp\/api\/v2\/search\/anime/
const DDP_BANGUMI_URL = /\/ddp\/api\/v2\/bangumi\//
const DDP_COMMENT_URL = /\/ddp\/api\/v2\/comment\//

interface Anime {
  animeId: number
  animeTitle: string
}

function anime(animeId: number, animeTitle: string) {
  return {
    animeId,
    bangumiId: `${animeId}`,
    animeTitle,
    type: 'tvseries',
    typeDescription: 'TV动画',
    imageUrl: `https://ddp-cdn.invalid/anime/${animeId}.jpg`,
    startDate: '2024-04-01T00:00:00',
    episodeCount: 12,
    rating: 0,
    isFavorited: false,
  }
}

function bangumi(entry: Anime) {
  return {
    errorCode: 0,
    errorMessage: '',
    success: true,
    bangumi: {
      ...anime(entry.animeId, entry.animeTitle),
      episodes: [1, 2, 3].map((n) => ({
        episodeId: entry.animeId * 10000 + n,
        episodeTitle: `第${n}话`,
        episodeNumber: `${n}`,
      })),
    },
  }
}

// DanDanPlay knows the show only under its bare title: a keyword carrying the
// season finds nothing, which is the bug this spec guards against.
function mockDandanplay(animes: Anime[], keywords: string[]) {
  return [
    {
      pattern: DDP_SEARCH_URL,
      respond: (route: Route) => {
        const keyword =
          new URL(route.request().url()).searchParams.get('keyword') ?? ''
        keywords.push(keyword)
        const matches = keyword === SHOW ? animes : []
        return route.fulfill({
          json: {
            errorCode: 0,
            errorMessage: '',
            success: true,
            animes: matches.map((a) => anime(a.animeId, a.animeTitle)),
          },
        })
      },
    },
    {
      pattern: DDP_BANGUMI_URL,
      respond: (route: Route) => {
        const path = new URL(route.request().url()).pathname
        const entry = animes.find((a) => path.endsWith(`/${a.animeId}`))
        if (!entry) {
          return route.fulfill({ status: 404, body: `unknown anime: ${path}` })
        }
        return route.fulfill({ json: bangumi(entry) })
      },
    },
    {
      pattern: DDP_COMMENT_URL,
      respond: (route: Route) =>
        route.fulfill({ json: loadJsonFixture('ddp-comments.json') }),
    },
  ]
}

async function openSeasonPage(
  context: BrowserContext,
  page: Page,
  da: DaClient,
  animes: Anime[]
) {
  const keywords: string[] = []
  await applyProfile(context, da, {
    providers: { dandanplay: { enabled: true } },
    network: mockDandanplay(animes, keywords),
  })
  const policy = buildFixtureIntegrationPolicy()
  policy.season.selector = [
    { value: '//*[@data-testid="da-season"]', quick: true },
  ]
  await seedXPathIntegration(da, { patterns: [MOUNT_PATTERN], policy })
  await da.mount.waitForRegistration(MOUNT_PATTERN, 5_000)

  const integrationPage = new IntegrationPage(page)
  await page.bringToFront()
  await integrationPage.open(NATIVE_URL, 'native-video-season.html')
  return { integrationPage, keywords }
}

test('the only result on the page season mounts from a bare-title search', async ({
  context,
  page,
  da,
}) => {
  const { keywords } = await openSeasonPage(context, page, da, [
    { animeId: 1001, animeTitle: SHOW },
    { animeId: 1002, animeTitle: `${SHOW} 第二季` },
    { animeId: 1003, animeTitle: `${SHOW} 3rd Season` },
  ])

  const toast = new Toast(page)
  await toast.expectSuccess(
    new RegExp(
      `^(Mounted .*${SHOW} 第二季.*: 4 comments|已装填 .*${SHOW} 第二季.*：4 条弹幕)`
    ),
    { timeout: 15_000 }
  )
  expect(keywords).toEqual([SHOW])
})

test('two results on the page season open the selector with them first', async ({
  context,
  page,
  da,
}) => {
  const { integrationPage } = await openSeasonPage(context, page, da, [
    { animeId: 1001, animeTitle: SHOW },
    { animeId: 1002, animeTitle: `${SHOW} 第二季` },
    { animeId: 1003, animeTitle: `${SHOW} 3rd Season` },
    { animeId: 1004, animeTitle: `${SHOW} Season 2` },
  ])

  await expect(integrationPage.controllerWindow()).toBeVisible({
    timeout: 15_000,
  })
  const cards = page.locator('[data-testid^="season-card-DanDanPlay-"]')
  await expect(cards).toHaveCount(4)
  await expect(cards.nth(0)).toContainText(`${SHOW} 第二季`)
  await expect(cards.nth(1)).toContainText(`${SHOW} Season 2`)
  await expect(cards.nth(2)).toContainText(/DA Integration Test$/)
  await expect(cards.nth(3)).toContainText(`${SHOW} 3rd Season`)
})
