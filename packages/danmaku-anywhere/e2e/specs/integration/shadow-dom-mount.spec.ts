import { IntegrationPage } from '../../pom/IntegrationPage'
import { expect, test } from '../../setup/fixtures'
import {
  FIXTURE_FIRST_TEXT,
  FIXTURE_SEEK_TIME_S,
  seedFixtureIntegration,
} from '../../setup/integration'

/**
 * Auto-mount on a web-component player whose <video> lives in an open shadow
 * root that is attached after the host is already in the page. Asserts the
 * danmaku overlay renders over that video, then that it is still drawn over
 * the player after the wrapper inside the shadow root enters fullscreen.
 */

const ORIGIN = 'https://da-test.invalid'
const SHADOW_URL = `${ORIGIN}/shadow/`
const MOUNT_PATTERN = `${ORIGIN}/*`

test('integration auto-mount: <video> inside a late shadow root, inline and fullscreen', async ({
  context,
  page,
  da,
}) => {
  const { episodeId } = await seedFixtureIntegration(context, da, [
    MOUNT_PATTERN,
  ])

  const integrationPage = new IntegrationPage(page)
  await page.bringToFront()
  await integrationPage.open(SHADOW_URL, 'native-video-shadow.html')
  await expect(integrationPage.floatingButton()).toBeVisible()
  await integrationPage.upgradeShadowPlayer()

  const mirror = await da.mount.waitForMount(undefined, 15_000)
  expect(mirror.episodeIds).toEqual([episodeId])

  await integrationPage.playVideo()
  await integrationPage.setVideoTime(FIXTURE_SEEK_TIME_S)
  await da.danmakuRender.waitForRendered(FIXTURE_FIRST_TEXT)
  await expect(integrationPage.danmuContainer()).toBeVisible()

  const videoBox = await integrationPage.video().boundingBox()
  const inlineBox = await integrationPage.danmuContainer().boundingBox()
  expect(inlineBox).toMatchObject({
    x: videoBox?.x,
    y: videoBox?.y,
    width: videoBox?.width,
  })

  await integrationPage.enterShadowPlayerFullscreen()
  await integrationPage.setVideoTime(FIXTURE_SEEK_TIME_S)
  await expect(integrationPage.danmuContainer()).toBeVisible()
  await expect
    .poll(
      async () => (await integrationPage.danmuContainer().boundingBox())?.width
    )
    .toBe(page.viewportSize()?.width)
  await expect(integrationPage.commentElements().first()).toBeVisible()
})
