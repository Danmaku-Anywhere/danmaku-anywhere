import { fakeBrowser } from '@webext-core/fake-browser'
import { describe, expect, it, vi } from 'vitest'
import { UpgradeFailureBadge } from '@/background/syncOptions/UpgradeFailureBadge'
import { IconService } from './IconService'

vi.mock('@/common/utils/utils', async (importOriginal) => {
  return {
    ...(await importOriginal<object>()),
    isServiceWorker: () => true,
  }
})

function watchTabBadge(tabId: number) {
  const texts: string[] = []
  vi.spyOn(fakeBrowser.action, 'setBadgeText').mockImplementation(
    async ({ text, tabId: target }) => {
      if (target === tabId) {
        texts.push(text ?? '')
      }
    }
  )
  vi.spyOn(fakeBrowser.action, 'setIcon').mockResolvedValue(undefined)
  return texts
}

describe('IconService', () => {
  it('marks a tab with mounted danmaku by a badge without a number', async () => {
    const texts = watchTabBadge(7)
    const service = new IconService(new UpgradeFailureBadge())

    await service.setActive(7)

    expect(texts).toEqual([' '])
  })

  it('clears the mark when the tab goes back to normal', async () => {
    const texts = watchTabBadge(7)
    const service = new IconService(new UpgradeFailureBadge())

    await service.setActive(7)
    await service.setNormal(7)

    expect(texts).toEqual([' ', ''])
  })
})
