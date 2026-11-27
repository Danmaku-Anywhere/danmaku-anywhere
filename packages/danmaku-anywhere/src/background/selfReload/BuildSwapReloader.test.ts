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
 * a changed build.json tag triggers chrome.runtime.reload, that an unchanged
 * or missing marker leaves the extension alone, and that the reload waits
 * while any tab is playing a video.
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

// Each open tab is one frame, and the injected function runs against the
// test document, so a tab "plays" when its turn finds a playing video there.
function openTabs(...playing: boolean[]) {
  fakeBrowser.tabs.query = vi.fn(async () => {
    return playing.map((_, id) => ({ id }) as chrome.tabs.Tab)
  })
  fakeBrowser.scripting.executeScript = vi.fn(async (injection) => {
    document.body.innerHTML = ''
    if (playing[injection.target.tabId]) {
      addVideo(document.body, true)
    }
    return [{ frameId: 0, documentId: '', result: injection.func() }]
  }) as typeof fakeBrowser.scripting.executeScript
}

function addVideo(parent: ParentNode, playing: boolean) {
  const video = document.createElement('video')
  Object.defineProperty(video, 'paused', { value: !playing })
  parent.append(video)
  return video
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
  fakeBrowser.reset()
  markerTag = undefined
  reload.mockClear()
  fakeBrowser.runtime.reload = reload
  openTabs()
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

  it('waits until no tab is playing a video', async () => {
    setInstallType('development')
    markerTag = 'v1'
    await startReloader()

    markerTag = 'v2'
    openTabs(false, true)
    await fireCheck()
    expect(reload).not.toHaveBeenCalled()

    openTabs(false, false)
    await fireCheck()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('finds a playing video inside a shadow root', async () => {
    setInstallType('development')
    markerTag = 'v1'
    await startReloader()

    markerTag = 'v2'
    openTabs(false)
    fakeBrowser.scripting.executeScript = vi.fn(async (injection) => {
      document.body.innerHTML = ''
      const host = document.createElement('div')
      document.body.append(host)
      addVideo(host.attachShadow({ mode: 'open' }), true)
      return [{ frameId: 0, documentId: '', result: injection.func() }]
    }) as typeof fakeBrowser.scripting.executeScript
    await fireCheck()
    expect(reload).not.toHaveBeenCalled()
  })

  it('treats a tab it cannot script as not playing', async () => {
    setInstallType('development')
    markerTag = 'v1'
    await startReloader()

    markerTag = 'v2'
    openTabs(true)
    fakeBrowser.scripting.executeScript = vi.fn(async () => {
      throw new Error('Cannot access a chrome:// URL')
    })
    await fireCheck()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops waiting on a tab that never answers', async () => {
    setInstallType('development')
    markerTag = 'v1'
    await startReloader()

    markerTag = 'v2'
    openTabs(true)
    fakeBrowser.scripting.executeScript = vi.fn(
      () => new Promise<chrome.scripting.InjectionResult[]>(() => {})
    ) as typeof fakeBrowser.scripting.executeScript
    vi.useFakeTimers()
    try {
      const check = fireCheck()
      await vi.advanceTimersByTimeAsync(2000)
      await check
    } finally {
      vi.useRealTimers()
    }
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
