import { Container } from 'inversify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoggerSymbol } from '@/common/Logger'
import type { MountConfig } from '@/common/options/mountConfig/schema'
import { MountConfigService } from '@/common/options/mountConfig/service'
import { silentLogger } from '@/tests/silentLogger'
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
 * from the enabled mount config patterns, and nowhere else. Runs against an
 * in-memory chrome.scripting registry and asserts what ends up registered
 * after first registration, updates, a controller-only install, and removal.
 */

type RegisteredScript = chrome.scripting.RegisteredContentScript
type ConfigListener = (configs: MountConfig[] | undefined) => Promise<void>

function createScriptingRegistry(initial: RegisteredScript[]) {
  const registry = new Map(
    initial.map((script) => {
      return [script.id, script]
    })
  )

  return {
    registry,
    api: {
      getRegisteredContentScripts: async (filter?: { ids?: string[] }) => {
        return [...registry.values()].filter((script) => {
          return !filter?.ids || filter.ids.includes(script.id)
        })
      },
      registerContentScripts: async (scripts: RegisteredScript[]) => {
        for (const script of scripts) {
          if (registry.has(script.id)) {
            throw new Error(`Duplicate script ID '${script.id}'`)
          }
          registry.set(script.id, script)
        }
      },
      updateContentScripts: async (scripts: RegisteredScript[]) => {
        for (const script of scripts) {
          const existing = registry.get(script.id)
          if (!existing) {
            throw new Error(`No script with ID '${script.id}'`)
          }
          registry.set(script.id, { ...existing, ...script })
        }
      },
      unregisterContentScripts: async (filter?: { ids?: string[] }) => {
        for (const id of filter?.ids ?? [...registry.keys()]) {
          registry.delete(id)
        }
      },
    },
  }
}

type ConfigInput = Pick<MountConfig, 'enabled' | 'patterns'>

function toMountConfigs(configs: ConfigInput[]): MountConfig[] {
  return configs.map((config, i) => {
    return { ...config, name: `config-${i}` } as MountConfig
  })
}

function setup(initial: RegisteredScript[], stored: ConfigInput[] = []) {
  let onChange: ConfigListener | undefined
  let onInstalled: (() => Promise<void>) | undefined
  const mountConfigService = {
    getAll: async () => {
      return toMountConfigs(stored)
    },
    options: {
      onChange: (listener: ConfigListener) => {
        onChange = listener
      },
    },
  }

  const { registry, api } = createScriptingRegistry(initial)
  vi.stubGlobal('chrome', {
    runtime: {
      onStartup: { addListener: () => {} },
      onInstalled: {
        addListener: (listener: () => Promise<void>) => {
          onInstalled = listener
        },
      },
    },
    scripting: api,
  })

  const container = new Container({ autobind: true })
  container.bind(LoggerSymbol).toConstantValue(silentLogger)
  container
    .bind<unknown>(MountConfigService)
    .toConstantValue(mountConfigService)
  container.get(ScriptingManager).setup()

  async function changeConfigs(configs: ConfigInput[]) {
    await onChange?.(toMountConfigs(configs))
  }

  async function installUpdate() {
    await onInstalled?.()
  }

  return { registry, changeConfigs, installUpdate }
}

function stale(id: string): RegisteredScript {
  return { id, js: ['stale.js'], matches: ['https://old.example/*'] }
}

const moviplayer = ['https://moviplayer.com/*']
const enabled = { enabled: true, patterns: moviplayer }

describe('ScriptingManager', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('registers the controller and the hook for enabled patterns only', async () => {
    const { registry, changeConfigs } = setup([])

    await changeConfigs([
      enabled,
      { enabled: false, patterns: ['https://disabled.example/*'] },
    ])

    expect(registry.get(MAIN_CONTENT_SCRIPT_ID)).toMatchObject({
      matches: moviplayer,
      world: 'ISOLATED',
    })
    expect(registry.get(SHADOW_HOOK_SCRIPT_ID)).toMatchObject({
      js: ['shadowHook.iife.js'],
      matches: moviplayer,
      world: 'MAIN',
      runAt: 'document_start',
      allFrames: true,
    })
  })

  it('moves both scripts to the new patterns when both are registered', async () => {
    const { registry, changeConfigs } = setup([
      stale(MAIN_CONTENT_SCRIPT_ID),
      stale(SHADOW_HOOK_SCRIPT_ID),
    ])

    await changeConfigs([enabled])

    expect(registry.get(MAIN_CONTENT_SCRIPT_ID)?.matches).toEqual(moviplayer)
    expect(registry.get(SHADOW_HOOK_SCRIPT_ID)?.matches).toEqual(moviplayer)
  })

  it('adds the hook to an install that only has the controller registered', async () => {
    const { registry, changeConfigs } = setup([stale(MAIN_CONTENT_SCRIPT_ID)])

    await changeConfigs([enabled])

    expect([...registry.keys()].sort()).toEqual(
      [MAIN_CONTENT_SCRIPT_ID, SHADOW_HOOK_SCRIPT_ID].sort()
    )
    expect(registry.get(MAIN_CONTENT_SCRIPT_ID)?.matches).toEqual(moviplayer)
    expect(registry.get(SHADOW_HOOK_SCRIPT_ID)?.matches).toEqual(moviplayer)
  })

  it('registers both scripts again after an extension update cleared them', async () => {
    const { registry, installUpdate } = setup([], [enabled])

    await installUpdate()

    expect(registry.get(MAIN_CONTENT_SCRIPT_ID)).toMatchObject({
      js: ['controller.js'],
      matches: moviplayer,
    })
    expect(registry.get(SHADOW_HOOK_SCRIPT_ID)?.matches).toEqual(moviplayer)
  })

  it('adds the hook on an extension update without waiting for a config change', async () => {
    const { registry, installUpdate } = setup(
      [stale(MAIN_CONTENT_SCRIPT_ID)],
      [enabled]
    )

    await installUpdate()

    expect(registry.get(SHADOW_HOOK_SCRIPT_ID)?.matches).toEqual(moviplayer)
    expect(registry.get(MAIN_CONTENT_SCRIPT_ID)?.matches).toEqual(moviplayer)
  })

  it('unregisters both when no config is enabled', async () => {
    const { registry, changeConfigs } = setup([
      stale(MAIN_CONTENT_SCRIPT_ID),
      stale(SHADOW_HOOK_SCRIPT_ID),
    ])

    await changeConfigs([{ ...enabled, enabled: false }])

    expect(registry.size).toBe(0)
  })
})
