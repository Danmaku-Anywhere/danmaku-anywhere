import { injectable } from 'inversify'

// One session storage key per playing frame, so concurrent play and pause
// events from different frames never overwrite each other.
const KEY_PREFIX = 'playbackTracker.playing:'

function tabPrefix(tabId: number) {
  return `${KEY_PREFIX}${tabId}:`
}

async function playingKeys(): Promise<string[]> {
  const all = await chrome.storage.session.get(null)
  return Object.keys(all).filter((key) => key.startsWith(KEY_PREFIX))
}

@injectable('Singleton')
export class PlaybackTracker {
  setup() {
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved)
  }

  async setPlaying(sender: chrome.runtime.MessageSender, playing: boolean) {
    const tabId = sender.tab?.id
    const frameId = sender.frameId
    if (tabId === undefined || frameId === undefined) {
      return
    }
    const key = `${tabPrefix(tabId)}${frameId}`
    if (playing) {
      await chrome.storage.session.set({ [key]: true })
    } else {
      await chrome.storage.session.remove(key)
    }
  }

  async isAnyPlaying(): Promise<boolean> {
    return (await playingKeys()).length > 0
  }

  private handleTabRemoved = async (tabId: number) => {
    const keys = (await playingKeys()).filter((key) => {
      return key.startsWith(tabPrefix(tabId))
    })
    if (keys.length > 0) {
      await chrome.storage.session.remove(keys)
    }
  }
}
