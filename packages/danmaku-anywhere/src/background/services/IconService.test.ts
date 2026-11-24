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

const mountedIcon = vi.hoisted(() => {
  return { 16: { tag: 'dot-16' }, 32: { tag: 'dot-32' } }
})

vi.mock('@/background/services/mountedIcon', () => {
  return { drawMountedIcon: vi.fn(async () => mountedIcon) }
})

function watchTab(tabId: number) {
  const texts: string[] = []
  const icons: unknown[] = []
  vi.spyOn(fakeBrowser.action, 'setBadgeText').mockImplementation(
    async ({ text, tabId: target }) => {
      if (target === tabId) {
        texts.push(text ?? '')
      }
    }
  )
  vi.spyOn(fakeBrowser.action, 'setIcon').mockImplementation(
    async ({ path, imageData, tabId: target }) => {
      if (target === tabId) {
        icons.push(path ?? imageData)
      }
    }
  )
  return { texts, icons }
}

describe('IconService', () => {
  it('marks a tab with mounted danmaku by the dotted icon and no badge', async () => {
    const { texts, icons } = watchTab(7)
    const service = new IconService(new UpgradeFailureBadge())

    await service.setActive(7)

    expect(texts).toEqual([''])
    expect(icons).toEqual([mountedIcon])
  })

  it('puts the plain icon back when the tab goes back to normal', async () => {
    const { icons } = watchTab(7)
    const service = new IconService(new UpgradeFailureBadge())

    await service.setActive(7)
    await service.setNormal(7)

    expect(icons).toEqual([mountedIcon, 'normal_32.png'])
  })
})
