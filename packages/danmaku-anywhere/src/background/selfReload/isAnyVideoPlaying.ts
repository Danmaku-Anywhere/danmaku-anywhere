// A frozen or hung tab may never run the injected script, so a tab that
// doesn't answer in time counts as not playing.
const ANSWER_TIMEOUT_MS = 2000

// Runs inside each frame, so it can't use anything from outside its own body.
function frameHasPlayingVideo(): boolean {
  const roots: ParentNode[] = [document]
  for (const root of roots) {
    for (const element of root.querySelectorAll('*')) {
      if (element instanceof HTMLVideoElement && !element.paused) {
        return true
      }
      if (element.shadowRoot) {
        roots.push(element.shadowRoot)
      }
    }
  }
  return false
}

async function tabHasPlayingVideo(tabId: number): Promise<boolean> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: frameHasPlayingVideo,
    })
    return results.some((frame) => {
      return frame.result === true
    })
  } catch {
    return false
  }
}

function timeout(): Promise<false> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(false), ANSWER_TIMEOUT_MS)
  })
}

export async function isAnyVideoPlaying(): Promise<boolean> {
  const tabs = await chrome.tabs.query({ discarded: false })
  const answers = await Promise.all(
    tabs.map((tab) => {
      if (tab.id === undefined) {
        return false
      }
      return Promise.race([tabHasPlayingVideo(tab.id), timeout()])
    })
  )
  return answers.includes(true)
}
