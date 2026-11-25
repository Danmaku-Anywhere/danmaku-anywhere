import type { ProviderConfig } from '../../../src/common/options/providerConfig/schema'
import { mockDandanplayCustom } from '../../network/dandanplay'
import { Popup } from '../../pom/Popup'
import { expect, test } from '../../setup/fixtures'
import { loadJsonFixture } from '../../setup/fixtures-loader'
import { applyProfile } from '../../setup/profile'

/**
 * A DanDanPlay-compatible server on a loopback host. The engine blocks private
 * and loopback hosts unless the config opted into local origins. With the
 * opt-in, results render and the comment count shows for a config pointed at
 * http://localhost. Without it, the search for that source fails with a retry.
 */

const LOCAL_BASE_URL = 'http://localhost:7766'

const localConfig: ProviderConfig = {
  id: 'local-ddp-1',
  manifestId: 'dandanplay',
  name: 'LocalDdp',
  enabled: true,
  configValues: {
    baseUrl: LOCAL_BASE_URL,
    auth: { enabled: false, headers: [] },
  },
}

function localServer() {
  return mockDandanplayCustom({
    baseUrl: LOCAL_BASE_URL,
    search: loadJsonFixture('ddp-compat-search.json'),
    bangumi: loadJsonFixture('ddp-compat-bangumi.json'),
    comments: loadJsonFixture('ddp-compat-comments.json'),
  })
}

test('dandanplay: loopback baseUrl resolves when the config allows local origins', async ({
  context,
  page,
  extensionId,
  da,
}) => {
  await applyProfile(context, da, {
    customProviders: [{ ...localConfig, allowLocalOrigins: true }],
    network: localServer(),
  })

  const popup = await Popup.open(page, extensionId)
  await popup.search.submit('frieren')
  await popup.search.openFirstResult('DanDanPlay')
  const episode =
    await popup.seasonDetails.fetchDanmakuForFirstEpisode('DanDanPlay')
  await popup.seasonDetails.expectCommentCountToBe(episode, 2)
})

test.describe('without the local-origins opt-in', () => {
  test.use({
    expectedConsoleErrors: [/\[RpcManager\] Error in RPC handler/],
  })

  test('dandanplay: loopback baseUrl stays blocked', async ({
    context,
    page,
    extensionId,
    da,
  }) => {
    await applyProfile(context, da, {
      customProviders: [localConfig],
      network: localServer(),
    })

    const popup = await Popup.open(page, extensionId)
    await popup.search.submit('frieren')

    await expect(popup.search.retryButton).toBeVisible()
  })
})
