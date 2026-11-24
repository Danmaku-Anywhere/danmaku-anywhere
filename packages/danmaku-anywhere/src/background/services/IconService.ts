import { inject, injectable } from 'inversify'
import { drawMountedIcon } from '@/background/services/mountedIcon'
import { UpgradeFailureBadge } from '@/background/syncOptions/UpgradeFailureBadge'
import { invariant, isServiceWorker } from '@/common/utils/utils'

@injectable('Singleton')
export class IconService {
  private mountedIcon?: Promise<Record<number, ImageData>>

  constructor(
    @inject(UpgradeFailureBadge)
    private readonly upgradeFailureBadge: UpgradeFailureBadge
  ) {
    invariant(
      isServiceWorker(),
      'IconService is only available in service worker'
    )
  }

  async setActive(tabId: number) {
    await this.setBadgeText('', tabId)
    await chrome.action.setIcon({
      imageData: await this.getMountedIcon(),
      tabId,
    })
  }

  async setUnavailable(tabId: number) {
    await this.setBadgeText('', tabId)
    await chrome.action.setIcon({ path: 'grey_32.png', tabId })
  }

  async setNormal(tabId: number) {
    await this.setBadgeText('', tabId)
    await chrome.action.setIcon({ path: 'normal_32.png', tabId })
  }

  private getMountedIcon() {
    if (!this.mountedIcon) {
      this.mountedIcon = drawMountedIcon().catch((error: unknown) => {
        this.mountedIcon = undefined
        throw error
      })
    }
    return this.mountedIcon
  }

  private async setBadgeText(text: string, tabId: number) {
    if (this.upgradeFailureBadge.isShowing()) {
      return
    }
    await chrome.action.setBadgeText({ text, tabId })
  }
}
