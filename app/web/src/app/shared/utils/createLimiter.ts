// One gate shared by every caller, so a burst of tasks from different places
// still runs at most `limit` at a time. Tasks wait their turn in call order,
// and a task whose signal is aborted while it waits gives its turn up unrun.
export function createLimiter(
  limit: number
): <T>(task: () => Promise<T>, signal?: AbortSignal) => Promise<T> {
  let active = 0
  const waiting: (() => void)[] = []

  const release = () => {
    const next = waiting.shift()
    if (next) {
      next()
      return
    }
    active--
  }

  const acquire = () => {
    if (active < limit) {
      active++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      waiting.push(resolve)
    })
  }

  return async function run<T>(
    task: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    signal?.throwIfAborted()
    await acquire()
    try {
      signal?.throwIfAborted()
      return await task()
    } finally {
      release()
    }
  }
}
