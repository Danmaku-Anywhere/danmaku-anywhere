import { inject, injectable } from 'inversify'
import { UpgradeFailureBadge } from '@/background/syncOptions/UpgradeFailureBadge'
import { sakuraLight } from '@/common/theme/sakuraTokens'
import { invariant, isServiceWorker } from '@/common/utils/utils'

// A single space draws the badge as a small empty pill.
const MOUNTED_BADGE_TEXT = ' '

@injectable('Singleton')
export class IconService {
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
    if (this.upgradeFailureBadge.isShowing()) {
      return
    }
    // Global rather than per tab, so the upgrade-failure badge's red still
    // wins on every tab once it shows.
    await chrome.action.setBadgeBackgroundColor({
      color: sakuraLight.success.main,
    })
    await chrome.action.setBadgeText({ text: MOUNTED_BADGE_TEXT, tabId })
  }

  async setUnavailable(tabId: number) {
    await this.setBadgeText('', tabId)
    await chrome.action.setIcon({ path: 'grey_32.png', tabId })
  }

  async setNormal(tabId: number) {
    await this.setBadgeText('', tabId)
    await chrome.action.setIcon({ path: 'normal_32.png', tabId })
  }

  private async setBadgeText(text: string, tabId: number) {
    if (this.upgradeFailureBadge.isShowing()) {
      return
    }
    await chrome.action.setBadgeText({ text, tabId })
  }
}
