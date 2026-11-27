import { inject, injectable } from 'inversify'
import { alarmKeys } from '@/common/alarms/constants'
import { type ILogger, LoggerSymbol } from '@/common/Logger'
import { ExtStorageService } from '@/common/storage/ExtStorageService'
import { isAnyVideoPlaying } from './isAnyVideoPlaying'

// Danmaku Builds writes this into the folder it swaps builds into.
const MARKER_FILE = 'build.json'

interface LoadedBuild {
  tag: string | null
}

async function readMarkerTag(): Promise<string | null> {
  try {
    const response = await fetch(chrome.runtime.getURL(MARKER_FILE), {
      cache: 'no-store',
    })
    const marker: unknown = await response.json()
    if (
      typeof marker === 'object' &&
      marker !== null &&
      'tag' in marker &&
      typeof marker.tag === 'string'
    ) {
      return marker.tag
    }
    return null
  } catch {
    return null
  }
}

// Chrome reads an unpacked extension's files straight from its folder, so
// once Danmaku Builds swaps in another build the marker on disk changes while
// the old code keeps running. Reloading picks up the new build.
@injectable('Singleton')
export class BuildSwapReloader {
  // Session storage is cleared whenever the extension reloads, so this holds
  // the tag of the files the running code was loaded from, across worker restarts.
  private readonly loaded = new ExtStorageService<LoadedBuild>(
    'buildSwapReloader.loaded',
    { storageType: 'session' }
  )
  private logger: ILogger

  constructor(@inject(LoggerSymbol) logger: ILogger) {
    this.logger = logger.sub('[BuildSwapReloader]')
  }

  setup() {
    chrome.alarms.onAlarm.addListener(this.handleAlarm)
    void this.start()
  }

  private async start() {
    const { installType } = await chrome.management.getSelf()
    if (installType !== 'development') {
      return
    }

    if (!(await this.loaded.read())) {
      await this.loaded.set({ tag: await readMarkerTag() })
    }

    if (!(await chrome.alarms.get(alarmKeys.CHECK_BUILD_SWAP))) {
      await chrome.alarms.create(alarmKeys.CHECK_BUILD_SWAP, {
        periodInMinutes: 0.5,
      })
    }
  }

  private handleAlarm = async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name !== alarmKeys.CHECK_BUILD_SWAP) {
      return
    }
    const loaded = await this.loaded.read()
    if (!loaded) {
      return
    }
    const tag = await readMarkerTag()
    if (tag === null || tag === loaded.tag) {
      return
    }
    if (await isAnyVideoPlaying()) {
      return
    }
    this.logger.info(`Build changed from ${loaded.tag} to ${tag}, reloading`)
    chrome.runtime.reload()
  }
}
