import { fakeBrowser } from '@webext-core/fake-browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { backgroundContainerModule } from '@/background/ioc'
import { LoggerSymbol } from '@/common/Logger'
import { createTestContainer } from '@/tests/createTestContainer'
import { silentLogger } from '@/tests/silentLogger'
import { BuildSwapReloader } from './BuildSwapReloader'

/**
 * An unpacked build that Danmaku Builds swapped out from under the extension
 * reloads itself. Covers that only development installs start the check, that
 * a changed build.json tag triggers chrome.runtime.reload, and that an
 * unchanged or missing marker leaves the extension alone.
 */

let markerTag: string | undefined
const reload = vi.fn()

function setInstallType(
  installType: chrome.management.ExtensionInfo['installType']
) {
  fakeBrowser.management.getSelf = vi.fn(async () => {
    return { installType } as chrome.management.ExtensionInfo
  })
}

function createReloader() {
  return createTestContainer(
    [backgroundContainerModule],
    [{ identifier: LoggerSymbol, value: silentLogger }]
  ).get(BuildSwapReloader)
}

async function startReloader() {
  const reloader = createReloader()
  reloader.setup()
  await vi.waitFor(async () => {
    expect(await fakeBrowser.alarms.get('check-build-swap')).toBeDefined()
  })
}

async function fireCheck() {
  await fakeBrowser.alarms.onAlarm.trigger({
    name: 'check-build-swap',
    scheduledTime: Date.now(),
    persistAcrossSessions: false,
  })
}

beforeEach(() => {
  markerTag = undefined
  reload.mockClear()
  fakeBrowser.runtime.reload = reload
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (markerTag === undefined) {
        throw new TypeError('Failed to fetch')
      }
      return new Response(JSON.stringify({ tag: markerTag }))
    })
  )
})

describe('BuildSwapReloader', () => {
  it('does nothing outside a development install', async () => {
    setInstallType('normal')
    markerTag = 'v1'
    createReloader().setup()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(await fakeBrowser.alarms.getAll()).toEqual([])
  })

  it('reloads when the marker tag changes', async () => {
    setInstallType('development')
    markerTag = 'v1'
    await startReloader()

    await fireCheck()
    expect(reload).not.toHaveBeenCalled()

    markerTag = 'v2'
    await fireCheck()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('remembers the tag it started with across worker restarts', async () => {
    setInstallType('development')
    markerTag = 'v1'
    await startReloader()

    markerTag = 'v2'
    fakeBrowser.alarms.onAlarm.removeAllListeners()
    await startReloader()
    await fireCheck()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves a build without a marker alone', async () => {
    setInstallType('development')
    await startReloader()

    await fireCheck()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads when a marker shows up in a folder that had none', async () => {
    setInstallType('development')
    await startReloader()

    markerTag = 'v1'
    await fireCheck()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
