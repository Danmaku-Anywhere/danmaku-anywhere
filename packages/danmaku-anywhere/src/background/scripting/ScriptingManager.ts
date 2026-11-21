import { inject, injectable } from 'inversify'
import { type ILogger, LoggerSymbol } from '@/common/Logger'
import type { MountConfig } from '@/common/options/mountConfig/schema'
import { MountConfigService } from '@/common/options/mountConfig/service'
import { createTaskQueue } from '@/common/utils/taskQueue'
// the ?script query is used to get the file path for the script after bundling
import contentScript from '@/content/controller?script'
import shadowHookScript from '@/content/shadowHook/index.iife?script'

export const MAIN_CONTENT_SCRIPT_ID = 'main-content'
export const SHADOW_HOOK_SCRIPT_ID = 'shadow-hook'

const mainScript: chrome.scripting.RegisteredContentScript = {
  id: MAIN_CONTENT_SCRIPT_ID,
  js: [contentScript],
  matches: [],
  persistAcrossSessions: true,
  allFrames: false, // only run in top frame
  runAt: 'document_idle',
  world: 'ISOLATED',
}

// Reports the page's attachShadow calls to the video observer. It patches a
// page global, so it only goes where the extension is mounted.
const shadowHook: chrome.scripting.RegisteredContentScript = {
  id: SHADOW_HOOK_SCRIPT_ID,
  js: [shadowHookScript],
  matches: [],
  persistAcrossSessions: true,
  allFrames: true,
  runAt: 'document_start',
  world: 'MAIN',
}

const scripts = [mainScript, shadowHook]

const q = createTaskQueue()

@injectable('Singleton')
export class ScriptingManager {
  private logger: ILogger

  constructor(
    @inject(MountConfigService)
    private mountConfigService: MountConfigService,
    @inject(LoggerSymbol) logger: ILogger
  ) {
    this.logger = logger.sub('[ScriptingManager]')
  }

  setup() {
    chrome.runtime.onStartup.addListener(() => this.syncFromStoredConfigs())
    // An update can add scripts to the managed set, and existing installs
    // would otherwise only pick them up on the next browser start.
    chrome.runtime.onInstalled.addListener(() => this.syncFromStoredConfigs())

    this.mountConfigService.options.onChange(async (configs) => {
      if (!configs) return

      await q.run(() => this.handleContentScriptRegistration(configs))
    })
  }

  private async syncFromStoredConfigs() {
    const configs = await this.mountConfigService.getAll()

    // ensure the handler doesn't run in parallel. This can happen because options.onChange can get called at startup
    await q.run(() => this.handleContentScriptRegistration(configs))
  }

  private async handleContentScriptRegistration(mountConfigs: MountConfig[]) {
    const patterns = mountConfigs
      // only register enabled configs
      .filter((configs) => configs.enabled)
      .map((config) => config.patterns)
      .flat()

    const registered = await chrome.scripting.getRegisteredContentScripts({
      ids: scripts.map((script) => script.id),
    })
    const registeredIds = new Set(registered.map((script) => script.id))

    if (patterns.length === 0) {
      if (registeredIds.size > 0) {
        this.logger.debug('Unregistering content scripts', { patterns })
        await chrome.scripting.unregisterContentScripts({
          ids: [...registeredIds],
        })
      }
      return
    }

    const toUpdate = scripts.filter((script) => registeredIds.has(script.id))
    const toRegister = scripts.filter((script) => !registeredIds.has(script.id))

    if (toRegister.length > 0) {
      this.logger.debug('Registering content scripts', { patterns })
      await chrome.scripting.registerContentScripts(
        toRegister.map((script) => {
          return { ...script, matches: patterns }
        })
      )
    }

    if (toUpdate.length > 0) {
      this.logger.debug('Updating content scripts', { patterns })
      await chrome.scripting.updateContentScripts(
        toUpdate.map((script) => {
          return { ...script, matches: patterns }
        })
      )
    }
  }
}
