import { IntegrationPage } from '../../pom/IntegrationPage'
import { expect, test } from '../../setup/fixtures'
import {
  FIXTURE_FIRST_TEXT,
  FIXTURE_SEEK_TIME_S,
  seedFixtureIntegration,
} from '../../setup/integration'

/**
 * Auto-mount on a web-component player whose <video> lives in a shadow root,
 * open or closed, that is attached after the host is already in the page.
 * Asserts the danmaku overlay renders over that video, then that it is still
 * drawn over the player after fullscreen, whether the player puts a wrapper
 * inside its shadow root or the host element itself into fullscreen.
 */

const ORIGIN = 'https://da-test.invalid'
const SHADOW_URL = `${ORIGIN}/shadow/`
const MOUNT_PATTERN = `${ORIGIN}/*`

const CASES = [
  { mode: 'open', fullscreenTarget: 'inner' },
  { mode: 'closed', fullscreenTarget: 'inner' },
  { mode: 'open', fullscreenTarget: 'host' },
  { mode: 'closed', fullscreenTarget: 'host' },
] as const

for (const { mode, fullscreenTarget } of CASES) {
  test(`integration auto-mount: <video> inside a late ${mode} shadow root, inline and fullscreen on the ${fullscreenTarget} element`, async ({
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
    await integrationPage.upgradeShadowPlayer(mode, fullscreenTarget)

    const mirror = await da.mount.waitForMount(undefined, 15_000)
    expect(mirror.episodeIds).toEqual([episodeId])

    await integrationPage.playVideo()
    await integrationPage.setVideoTime(FIXTURE_SEEK_TIME_S)
    await da.danmakuRender.waitForRendered(FIXTURE_FIRST_TEXT)
    await expect(integrationPage.danmuContainer()).toBeVisible()

    const videoBox = await integrationPage.videoBox()
    const inlineBox = await integrationPage.danmuContainer().boundingBox()
    expect(inlineBox).toMatchObject({
      x: videoBox?.x,
      y: videoBox?.y,
      width: videoBox?.width,
    })

    await integrationPage.enterShadowPlayerFullscreen()
    await integrationPage.setVideoTime(FIXTURE_SEEK_TIME_S)
    await expect
      .poll(async () => {
        const box = await integrationPage.overlayBoxInShadowFullscreen(
          '[data-danmu-container]'
        )
        return box?.width
      })
      .toBe(page.viewportSize()?.width)
    await expect
      .poll(async () => {
        const box =
          await integrationPage.overlayBoxInShadowFullscreen('.da-danmaku')
        return (box?.width ?? 0) > 0
      })
      .toBe(true)
  })
}
