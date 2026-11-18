import type {
  KazumiApiRequest,
  KazumiChapterApiConfig,
  KazumiChapterResult,
  KazumiPolicy,
  KazumiSearchApiConfig,
  KazumiSearchResult,
} from '@danmaku-anywhere/extension-protocol'
import { isRecord, readJsonPath, readJsonPathFirst } from './jsonPath.js'

type Variables = Record<string, unknown>

type BodyType = 'json' | 'form' | 'none'

export type SessionHeaderSetter = (
  matchUrl: string,
  headers: Record<string, string>
) => Promise<AsyncDisposable>

export type KazumiApiOptions = {
  setSessionHeader?: SessionHeaderSetter
  timeoutMs?: number
}

type PreparedRequest = {
  method: 'GET' | 'POST'
  url: string
  headers: Record<string, string>
  sessionHeaders: Record<string, string>
  query: Record<string, unknown>
  bodyType: BodyType
  body: unknown
}

const VARIABLE_PATTERN = /(?<![A-Za-z0-9_])@([A-Za-z_][A-Za-z0-9_]*)/g
const EXACT_VARIABLE_PATTERN = /^@([A-Za-z_][A-Za-z0-9_]*)$/

const DEFAULT_TIMEOUT_MS = 30_000

// fetch() silently drops these request headers, so they are applied with a
// declarativeNetRequest session rule around the request instead.
const SESSION_HEADER_NAMES: Record<string, string> = {
  referer: 'Referer',
  'user-agent': 'User-Agent',
  cookie: 'Cookie',
  origin: 'Origin',
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return typeof value === 'string' ? value.trim() : String(value)
}

function isHttpProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:'
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function toStringRecord(value: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(toRecord(value))) {
    result[key] = item === null || item === undefined ? '' : String(item)
  }
  return result
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('API response is not JSON')
  }
}

function parseBodyType(value: string): BodyType {
  if (value === 'json' || value === 'form' || value === 'none') {
    return value
  }
  throw new Error(`Unsupported API body type: ${value}`)
}

function splitHeaders(
  rendered: Record<string, string>,
  baseUrl: string
): Pick<PreparedRequest, 'headers' | 'sessionHeaders'> {
  const headers: Record<string, string> = {}
  const sessionHeaders: Record<string, string> = {
    Referer: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
  }
  for (const [name, value] of Object.entries(rendered)) {
    const sessionName = SESSION_HEADER_NAMES[name.toLowerCase()]
    if (sessionName) {
      sessionHeaders[sessionName] = value
    } else {
      headers[name] = value
    }
  }
  return { headers, sessionHeaders }
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

export function renderTemplate(
  template: string,
  variables: Variables,
  encode = false
): string {
  return template.replace(VARIABLE_PATTERN, (match, name: string) => {
    if (!Object.hasOwn(variables, name)) {
      throw new Error(`Missing template variable ${match}`)
    }
    const value = variables[name]
    const text = value === null || value === undefined ? '' : String(value)
    return encode ? encodeURIComponent(text) : text
  })
}

export function renderValue(value: unknown, variables: Variables): unknown {
  if (typeof value === 'string') {
    const exact = EXACT_VARIABLE_PATTERN.exec(value)
    if (exact) {
      const name = exact[1]
      if (!Object.hasOwn(variables, name)) {
        throw new Error(`Missing template variable @${name}`)
      }
      return variables[name]
    }
    return renderTemplate(value, variables)
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderValue(item, variables))
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      result[renderTemplate(key, variables)] = renderValue(item, variables)
    }
    return result
  }
  return value
}

export function prepareRequest(
  config: KazumiApiRequest,
  variables: Variables,
  baseUrl: string
): PreparedRequest {
  const upperMethod = config.method.toUpperCase()
  let method: 'GET' | 'POST' = 'GET'
  if (upperMethod === 'POST') {
    method = 'POST'
  } else if (upperMethod !== 'GET') {
    throw new Error(`Unsupported API method: ${upperMethod}`)
  }
  const bodyType = parseBodyType(config.bodyType)

  const trimmedUrl = config.url.trim()
  if (!trimmedUrl) {
    throw new Error('API request url is empty')
  }
  const url = renderTemplate(trimmedUrl, variables, true)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid API url: ${url}`)
  }
  if (!parsed.host) {
    throw new Error(`Invalid API url: ${url}`)
  }

  const hasBody = method === 'POST' && bodyType !== 'none'
  return {
    method,
    url,
    ...splitHeaders(
      toStringRecord(renderValue(config.headers, variables)),
      baseUrl
    ),
    query: toRecord(renderValue(config.query, variables)),
    bodyType,
    body: hasBody ? renderValue(config.body, variables) : undefined,
  }
}

export async function executeRequest(
  request: PreparedRequest,
  options: KazumiApiOptions = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const url = new URL(request.url)
  for (const [key, value] of Object.entries(request.query)) {
    if (value === null || value === undefined) {
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item))
      }
    } else {
      url.searchParams.append(key, String(value))
    }
  }

  const headers = new Headers(request.headers)
  const init: RequestInit = {
    method: request.method,
    headers,
    credentials: 'include',
    signal: AbortSignal.timeout(timeoutMs),
  }
  if (request.method === 'POST' && request.body !== undefined) {
    if (!headers.has('content-type')) {
      headers.set(
        'content-type',
        request.bodyType === 'form'
          ? 'application/x-www-form-urlencoded'
          : 'application/json'
      )
    }
    if (request.bodyType === 'form') {
      init.body = new URLSearchParams(toStringRecord(request.body)).toString()
    } else {
      init.body = JSON.stringify(request.body)
    }
  }

  await using _sessionRule = options.setSessionHeader
    ? await options.setSessionHeader(
        `${url.origin}${url.pathname}`,
        request.sessionHeaders
      )
    : null

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(
        `API request timed out after ${timeoutMs / 1000}s: ${url.host}`
      )
    }
    throw error
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${url.host}`)
  }
  return response.text()
}

export function parseSearch(
  raw: string,
  config: KazumiSearchApiConfig
): KazumiSearchResult[] {
  if (config.sourceTemplate && !config.sourceTemplate.includes('@source')) {
    throw new Error('Search source template is missing @source')
  }
  const document = parseJson(raw)
  const nodes = readJsonPath(document, config.listPath)
  const results: KazumiSearchResult[] = []
  for (const node of nodes) {
    const name = stringValue(readJsonPathFirst(node, config.namePath))
    const source = stringValue(readJsonPathFirst(node, config.sourcePath))
    if (!name || !source) {
      continue
    }
    const url = config.sourceTemplate
      ? config.sourceTemplate.replaceAll('@source', () =>
          encodeURIComponent(source)
        )
      : source
    results.push({ name, url })
  }
  return results
}

export function normalizeEpisodeUrl(baseUrl: string, raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }

  let resolved: URL
  try {
    resolved = new URL(trimmed, baseUrl)
  } catch {
    return trimmed
  }
  if (!resolved.host) {
    return trimmed
  }

  try {
    const base = new URL(baseUrl)
    if (
      isHttpProtocol(base.protocol) &&
      isHttpProtocol(resolved.protocol) &&
      resolved.protocol !== base.protocol &&
      resolved.host === base.host
    ) {
      resolved.protocol = base.protocol
    }
  } catch {
    return resolved.toString()
  }

  if (resolved.pathname.length > 1 && resolved.pathname.endsWith('/')) {
    resolved.pathname = resolved.pathname.replace(/\/+$/, '')
  }
  // Assigning an empty search removes the bare '?' URL keeps for an empty query.
  if (!resolved.search) {
    resolved.search = ''
  }
  if (resolved.href.endsWith('#')) {
    resolved.hash = ''
  }
  return resolved.toString()
}

function resolveEpisodeUrl(
  config: KazumiChapterApiConfig,
  variables: Variables,
  rawUrl: string,
  roadIndex: number,
  episodeIndex: number,
  baseUrl: string
): string {
  const page = config.episodePage
  if (!page) {
    return normalizeEpisodeUrl(baseUrl, rawUrl)
  }
  if (!page.url.trim()) {
    throw new Error('Episode page url template is empty')
  }

  const pageVariables: Variables = {
    ...variables,
    episodeUrl: rawUrl,
    roadIndex,
    roadNumber: roadIndex + 1,
    episodeIndex,
    episodeNumber: episodeIndex + 1,
  }
  const url = new URL(renderTemplate(page.url, pageVariables, true), baseUrl)
  const query = toStringRecord(renderValue(page.query, pageVariables))
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return normalizeEpisodeUrl(baseUrl, url.toString())
}

function parseNested(
  document: unknown,
  config: KazumiChapterApiConfig,
  variables: Variables,
  baseUrl: string
): KazumiChapterResult[][] {
  const hasRoads = config.roadsPath.trim().length > 0
  const roadNodes = hasRoads
    ? readJsonPath(document, config.roadsPath)
    : [document]
  const roads: KazumiChapterResult[][] = []

  for (const [roadIndex, roadNode] of roadNodes.entries()) {
    const episodes = readJsonPath(roadNode, config.episodesPath)
    const chapters: KazumiChapterResult[] = []
    for (const [episodeIndex, episodeNode] of episodes.entries()) {
      const name = stringValue(
        readJsonPathFirst(episodeNode, config.episodeNamePath)
      )
      const rawUrl = config.episodeUrlPath.trim()
        ? stringValue(readJsonPathFirst(episodeNode, config.episodeUrlPath))
        : ''
      const url = resolveEpisodeUrl(
        config,
        variables,
        rawUrl,
        roadIndex,
        episodeIndex,
        baseUrl
      )
      if (!url) {
        continue
      }
      chapters.push({ name: name || `第${episodeIndex + 1}集`, url })
    }
    if (chapters.length > 0) {
      roads.push(chapters)
    }
  }
  return roads
}

function parseDelimited(
  document: unknown,
  config: KazumiChapterApiConfig,
  variables: Variables,
  baseUrl: string
): KazumiChapterResult[][] {
  const episodes = stringValue(
    readJsonPathFirst(document, config.roadEpisodesPath)
  )
  if (!episodes) {
    return []
  }

  const roads: KazumiChapterResult[][] = []
  const groups = episodes.split(config.roadSeparator)
  for (const [roadIndex, group] of groups.entries()) {
    const chapters: KazumiChapterResult[] = []
    const entries = group.split(config.episodeSeparator)
    for (const [episodeIndex, entry] of entries.entries()) {
      const trimmed = entry.trim()
      if (!trimmed) {
        continue
      }
      const separatorIndex = trimmed.indexOf(config.fieldSeparator)
      if (separatorIndex < 0) {
        continue
      }
      const name = trimmed.slice(0, separatorIndex).trim()
      const rawUrl = trimmed
        .slice(separatorIndex + config.fieldSeparator.length)
        .trim()
      const url = resolveEpisodeUrl(
        config,
        variables,
        rawUrl,
        roadIndex,
        episodeIndex,
        baseUrl
      )
      if (!url) {
        continue
      }
      chapters.push({ name: name || `第${episodeIndex + 1}集`, url })
    }
    if (chapters.length > 0) {
      roads.push(chapters)
    }
  }
  return roads
}

function assertSeparator(value: string, label: string): void {
  if (!value) {
    throw new Error(`Chapter ${label} is empty`)
  }
}

// The parser can produce an empty playlist for a misconfigured rule. Treat
// that as a failure, like the xpath branch does, instead of reporting a
// successful search with no episodes.
function assertChapterConfig(config: KazumiChapterApiConfig): void {
  if (!config.episodesPath.trim() && config.format !== 'delimited') {
    throw new Error('Chapter episodes path is empty')
  }
  if (config.format === 'delimited') {
    if (!config.roadEpisodesPath.trim()) {
      throw new Error('Chapter road episodes path is empty')
    }
    assertSeparator(config.roadSeparator, 'road separator')
    assertSeparator(config.episodeSeparator, 'episode separator')
    assertSeparator(config.fieldSeparator, 'field separator')
    return
  }
  if (!config.episodeUrlPath.trim() && !config.episodePage) {
    throw new Error('Chapter config needs episodeUrlPath or episodePage')
  }
}

export function parseChapters(
  raw: string,
  config: KazumiChapterApiConfig,
  source: string,
  baseUrl: string
): KazumiChapterResult[][] {
  assertChapterConfig(config)
  const document = parseJson(raw)
  const variables: Variables = { source }
  for (const [key, path] of Object.entries(config.variables)) {
    const value = readJsonPathFirst(document, path)
    if (value === undefined || value === null) {
      throw new Error(`Missing chapter variable ${key}: ${path}`)
    }
    variables[key] = value
  }

  const roads =
    config.format === 'delimited'
      ? parseDelimited(document, config, variables, baseUrl)
      : parseNested(document, config, variables, baseUrl)
  if (roads.length === 0) {
    throw new Error('No chapters found')
  }
  return roads
}

export async function kazumiSearchApi(
  keyword: string,
  policy: KazumiPolicy,
  options: KazumiApiOptions = {}
): Promise<KazumiSearchResult[]> {
  const config = policy.searchApiConfig
  if (!config) {
    throw new Error(`Policy ${policy.name} has no search API config`)
  }
  const request = prepareRequest(config.request, { keyword }, policy.baseURL)
  const results = parseSearch(await executeRequest(request, options), config)
  if (policy.chapterMode === 'api') {
    return results
  }
  // A template-less search config returns the source id, which is only a page
  // path when the chapters come from XPath.
  return results.map((result) => ({
    ...result,
    url: normalizeEpisodeUrl(policy.baseURL, result.url),
  }))
}

export async function kazumiGetChaptersApi(
  contentUrl: string,
  policy: KazumiPolicy,
  options: KazumiApiOptions = {}
): Promise<KazumiChapterResult[][]> {
  const config = policy.chapterApiConfig
  if (!config) {
    throw new Error(`Policy ${policy.name} has no chapter API config`)
  }
  const request = prepareRequest(
    config.request,
    { source: contentUrl },
    policy.baseURL
  )
  return parseChapters(
    await executeRequest(request, options),
    config,
    contentUrl,
    policy.baseURL
  )
}
