import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ILogger } from '@/common/Logger'
import type { MountConfig } from '@/common/options/mountConfig/schema'
import type { MountConfigService } from '@/common/options/mountConfig/service'
import {
  MAIN_CONTENT_SCRIPT_ID,
  ScriptingManager,
  SHADOW_HOOK_SCRIPT_ID,
} from './ScriptingManager'

vi.mock('@/content/controller?script', () => {
  return { default: 'controller.js' }
})
vi.mock('@/content/shadowHook/index.iife?script', () => {
  return { default: 'shadowHook.iife.js' }
})

/**
 * The controller and the main-world attachShadow hook are registered together
 * from the enabled mount config patterns, and nowhere else. Covers first
 * registration, updates, an install that only has the controller, and removal.
 */

type ConfigListener = (configs: MountConfig[] | undefined) => Promise<void>

function createLogger(): ILogger {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    sub: () => logger,
  }
  return logger as unknown as ILogger
}

function setup(registeredIds: string[]) {
  let onChange: ConfigListener | undefined
  const mountConfigService = {
    getAll: vi.fn(),
    options: {
      onChange: (listener: ConfigListener) => {
        onChange = listener
      },
    },
  } as unknown as MountConfigService

  const scripting = {
    getRegisteredContentScripts: vi.fn(async () => {
      return registeredIds.map((id) => {
        return { id }
      })
    }),
    registerContentScripts: vi.fn(async () => {}),
    updateContentScripts: vi.fn(async () => {}),
    unregisterContentScripts: vi.fn(async () => {}),
  }
  vi.stubGlobal('chrome', {
    runtime: { onStartup: { addListener: vi.fn() } },
    scripting,
  })

  new ScriptingManager(mountConfigService, createLogger()).setup()

  async function changeConfigs(configs: Partial<MountConfig>[]) {
    await onChange?.(configs as MountConfig[])
  }

  return { scripting, changeConfigs }
}

const enabled = { enabled: true, patterns: ['https://moviplayer.com/*'] }

describe('ScriptingManager', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers the controller and the hook for enabled patterns only', async () => {
    const { scripting, changeConfigs } = setup([])

    await changeConfigs([
      enabled,
      { enabled: false, patterns: ['https://disabled.example/*'] },
    ])

    expect(scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: MAIN_CONTENT_SCRIPT_ID,
        matches: ['https://moviplayer.com/*'],
        world: 'ISOLATED',
      }),
      expect.objectContaining({
        id: SHADOW_HOOK_SCRIPT_ID,
        js: ['shadowHook.iife.js'],
        matches: ['https://moviplayer.com/*'],
        world: 'MAIN',
        runAt: 'document_start',
        allFrames: true,
      }),
    ])
  })

  it('updates both scripts when both are registered', async () => {
    const { scripting, changeConfigs } = setup([
      MAIN_CONTENT_SCRIPT_ID,
      SHADOW_HOOK_SCRIPT_ID,
    ])

    await changeConfigs([enabled])

    expect(scripting.registerContentScripts).not.toHaveBeenCalled()
    expect(scripting.updateContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: MAIN_CONTENT_SCRIPT_ID,
        matches: ['https://moviplayer.com/*'],
      }),
      expect.objectContaining({
        id: SHADOW_HOOK_SCRIPT_ID,
        matches: ['https://moviplayer.com/*'],
      }),
    ])
  })

  it('adds the hook to an install that only has the controller registered', async () => {
    const { scripting, changeConfigs } = setup([MAIN_CONTENT_SCRIPT_ID])

    await changeConfigs([enabled])

    expect(scripting.registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ id: SHADOW_HOOK_SCRIPT_ID }),
    ])
    expect(scripting.updateContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ id: MAIN_CONTENT_SCRIPT_ID }),
    ])
  })

  it('unregisters both when no config is enabled', async () => {
    const { scripting, changeConfigs } = setup([
      MAIN_CONTENT_SCRIPT_ID,
      SHADOW_HOOK_SCRIPT_ID,
    ])

    await changeConfigs([{ ...enabled, enabled: false }])

    expect(scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: [MAIN_CONTENT_SCRIPT_ID, SHADOW_HOOK_SCRIPT_ID],
    })
    expect(scripting.registerContentScripts).not.toHaveBeenCalled()
  })
})
