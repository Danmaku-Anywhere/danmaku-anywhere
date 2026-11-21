import { IntegrationPage } from '../../pom/IntegrationPage'
import { expect, test } from '../../setup/fixtures'
import { seedFixtureIntegration } from '../../setup/integration'
import { swapExtension } from '../../setup/swapExtension'

/**
 * Chrome clears dynamically registered content scripts when the extension updates,
 * which is what an in-place swap and reload does. Seeds an enabled mount
 * config, checks the floating button shows, updates the extension over
 * itself, and asserts the floating button shows again on a matching page
 * without the mount config being touched.
 */

const ORIGIN = 'https://da-test.invalid'
const NATIVE_URL = `${ORIGIN}/native/`
const MOUNT_PATTERN = `${ORIGIN}/*`

test.use({
  updatableExtension: true,
  // The old worker can still be answering the closed tab when it is replaced.
  expectedConsoleErrors: [
    /\[sw\] \[RpcManager\].*Receiving end does not exist/,
  ],
})

test('the floating button comes back after an extension update', async ({
  context,
  page,
  da,
  extensionPath,
}) => {
  await seedFixtureIntegration(context, da, [MOUNT_PATTERN])

  const beforeUpdate = new IntegrationPage(page)
  await beforeUpdate.open(NATIVE_URL, 'native-video.html')
  await expect(beforeUpdate.floatingButton()).toBeVisible({ timeout: 10_000 })
  // The update invalidates this page's content script, which then logs errors.
  await page.close()

  await swapExtension(context, extensionPath)

  const updatedPage = await context.newPage()
  const afterUpdate = new IntegrationPage(updatedPage)
  await afterUpdate.open(NATIVE_URL, 'native-video.html')
  await expect(async () => {
    await updatedPage.reload({ timeout: 5_000 })
    await expect(afterUpdate.floatingButton()).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
})
