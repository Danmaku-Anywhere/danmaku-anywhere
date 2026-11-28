import {
  type ConfigIssue,
  type ConfigSchema,
  validateConfig,
} from '@mr-quin/dango'
import { i18n } from '@/common/localization/i18n'
import { isBuiltinConfig } from '@/common/options/providerConfig/displayName'
import type { ProviderConfig } from '@/common/options/providerConfig/schema'

export type FieldKind =
  | 'text'
  | 'number'
  | 'select'
  | 'boolean'
  | 'object'
  | 'array'
  | 'unknown'

export interface FieldDescriptor {
  key: string
  schema: ConfigSchema
  required: boolean
}

// Empty/invalid number inputs become undefined rather than NaN, which would
// otherwise serialize to null when merged into configValues.
export function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  const trimmed = typeof value === 'string' ? value.trim() : value
  if (trimmed === '') {
    return undefined
  }
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? undefined : parsed
}

// Seasons are keyed by the config that fetched them, so pointing the built-in
// at another server would mix two catalogs under one id. A different server
// gets its own instance. The built-in talks to the hosted proxy, which signs
// requests itself, so its credential fields have nothing to do either.
const BUILTIN_HIDDEN_FIELDS: ReadonlySet<string> = new Set([
  'baseUrl',
  'appId',
  'appSecret',
  'auth',
])

const NO_HIDDEN_FIELDS: ReadonlySet<string> = new Set()

export function hiddenConfigFields(
  config: ProviderConfig
): ReadonlySet<string> {
  return isBuiltinConfig(config) ? BUILTIN_HIDDEN_FIELDS : NO_HIDDEN_FIELDS
}

export interface SelectOption {
  value: string | number
  label: string
}

function isOptionValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

// JSON Schema's labelled enum: `oneOf: [{ const, title }]`. Only used when
// every branch is such an option, so a oneOf that combines real subschemas is
// not mistaken for a choice list.
function labelledOptions(branches: unknown): SelectOption[] | null {
  if (!Array.isArray(branches) || branches.length === 0) {
    return null
  }
  const options: SelectOption[] = []
  for (const branch of branches) {
    if (!isRecord(branch) || !isOptionValue(branch.const)) {
      return null
    }
    const title = branch.title
    options.push({
      value: branch.const,
      label:
        typeof title === 'string' && title.length > 0
          ? title
          : String(branch.const),
    })
  }
  return options
}

export function getSelectOptions(schema: ConfigSchema): SelectOption[] {
  const labelled =
    labelledOptions(schema.oneOf) ?? labelledOptions(schema.anyOf)
  if (labelled) {
    return labelled
  }
  return (schema.enum ?? [])
    .filter(isOptionValue)
    .map((value) => ({ value, label: String(value) }))
}

export function getFieldKind(schema: ConfigSchema): FieldKind {
  if (getSelectOptions(schema).length > 0) {
    return 'select'
  }
  switch (schema.type) {
    case 'object':
      return 'object'
    case 'array':
      return 'array'
    case 'boolean':
      return 'boolean'
    case 'integer':
    case 'number':
      return 'number'
    case 'string':
      return 'text'
    default:
      return 'unknown'
  }
}

export function getObjectFields(
  schema: ConfigSchema | undefined
): FieldDescriptor[] {
  if (!schema?.properties) {
    return []
  }
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties).map(([key, propSchema]) => ({
    key,
    schema: propSchema,
    required: required.has(key),
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// NaN (e.g. from a cleared number input) is not a usable stored value, so it
// falls back to the schema default like a missing value.
function hasStoredValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false
  }
  return !(typeof value === 'number' && Number.isNaN(value))
}

function buildFieldDefault(schema: ConfigSchema, value: unknown): unknown {
  switch (getFieldKind(schema)) {
    case 'object': {
      const stored = isRecord(value) ? value : {}
      const out: Record<string, unknown> = {}
      for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
        out[key] = buildFieldDefault(propSchema, stored[key])
      }
      return out
    }
    case 'array': {
      const stored = Array.isArray(value)
        ? value
        : Array.isArray(schema.default)
          ? schema.default
          : []
      const itemSchema = schema.items
      if (!itemSchema) {
        return stored
      }
      return stored.map((item) => buildFieldDefault(itemSchema, item))
    }
    case 'boolean':
      if (typeof value === 'boolean') {
        return value
      }
      return typeof schema.default === 'boolean' ? schema.default : false
    case 'select': {
      const values = getSelectOptions(schema).map((option) => option.value)
      if (hasStoredValue(value) && values.some((option) => option === value)) {
        return value
      }
      if (schema.default !== undefined) {
        return schema.default
      }
      return values[0] ?? ''
    }
    case 'number':
      if (hasStoredValue(value)) {
        return value
      }
      return schema.default ?? ''
    default:
      if (hasStoredValue(value)) {
        return value
      }
      return schema.default ?? ''
  }
}

export function buildDefaultValues(
  schema: ConfigSchema | undefined,
  values: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!schema?.properties) {
    return {}
  }
  const safeValues = values ?? {}
  const out: Record<string, unknown> = {}
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    out[key] = buildFieldDefault(propSchema, safeValues[key])
  }
  return out
}

export interface ConfigValueError {
  path: string
  message: string
}

function joinPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`
}

function fieldTitle(schema: ConfigSchema, key: string): string {
  const title = schema.properties?.[key]?.title
  return typeof title === 'string' && title.length > 0 ? title : key
}

function schemaAt(
  schema: ConfigSchema,
  path: (string | number)[]
): ConfigSchema | undefined {
  let node: ConfigSchema | undefined = schema
  for (const step of path) {
    node =
      typeof step === 'number' ? node?.items : node?.properties?.[String(step)]
  }
  return node
}

function valueAt(value: unknown, path: (string | number)[]): unknown {
  let node = value
  for (const step of path) {
    if (node === null || typeof node !== 'object') {
      return undefined
    }
    node = (node as Record<string | number, unknown>)[step]
  }
  return node
}

function alternativesMessage(
  node: ConfigSchema | undefined,
  alternatives: string[][]
): string {
  const language = i18n.language
  const and = new Intl.ListFormat(language, { type: 'conjunction' })
  const or = new Intl.ListFormat(language, { type: 'disjunction' })
  const fields = or.format(
    alternatives.map((keys) =>
      and.format(keys.map((key) => (node ? fieldTitle(node, key) : key)))
    )
  )
  return i18n.t(
    'providers.editor.validation.requiredAlternatives',
    'Fill in {{fields}}',
    { fields }
  )
}

// Codes without a message here (enum, type other than integer, array bounds,
// additionalProperties, a pattern that is not a regex) are not shown to the
// user: the form inputs cannot produce them and a schema mistake is not
// something the user can fix.
function issueMessage(
  issue: ConfigIssue,
  schema: ConfigSchema,
  values: unknown
): string | null {
  const { min, max, pattern } = issue.params ?? {}
  switch (issue.code) {
    case 'required':
      return i18n.t(
        'providers.editor.validation.required',
        'This field is required'
      )
    case 'requiredAlternatives':
      return alternativesMessage(
        schemaAt(schema, issue.path),
        alternativesOf(issue)
      )
    case 'minLength':
      return i18n.t(
        'providers.editor.validation.minLength',
        'Must be at least {{min}} characters',
        { min }
      )
    case 'maxLength':
      return i18n.t(
        'providers.editor.validation.maxLength',
        'Must be at most {{max}} characters',
        { max }
      )
    case 'pattern':
      return i18n.t(
        'providers.editor.validation.pattern',
        'Must match the pattern {{pattern}}',
        { pattern }
      )
    case 'format':
      return i18n.t('providers.editor.validation.url', 'Not a valid URL')
    case 'minimum':
      return i18n.t(
        'providers.editor.validation.minimum',
        'Must be at least {{min}}',
        { min }
      )
    case 'maximum':
      return i18n.t(
        'providers.editor.validation.maximum',
        'Must be at most {{max}}',
        { max }
      )
    case 'type':
      if (
        issue.params?.expected === 'integer' &&
        typeof valueAt(values, issue.path) === 'number'
      ) {
        return i18n.t(
          'providers.editor.validation.integer',
          'Must be a whole number'
        )
      }
      return null
    default:
      return null
  }
}

function isDeclaredRequirement(
  issue: ConfigIssue,
  schema: ConfigSchema
): boolean {
  if (issue.code !== 'required') {
    return true
  }
  const key = String(issue.path[issue.path.length - 1])
  return (
    schemaAt(schema, issue.path.slice(0, -1))?.properties?.[key] !== undefined
  )
}

// Empty values are valid here; `required` is enforced separately so optional
// fields can stay blank without tripping their constraints.
export function validateScalar(
  schema: ConfigSchema,
  value: unknown
): string | null {
  for (const issue of validateConfig(schema, value)) {
    const message = issueMessage(issue, schema, value)
    if (message) {
      return message
    }
  }
  return null
}

export function validateConfigValues(
  schema: ConfigSchema | undefined,
  values: Record<string, unknown>
): ConfigValueError[] {
  if (!schema?.properties) {
    return []
  }
  const errors: ConfigValueError[] = []
  const reported = new Set<string>()
  for (const issue of validateConfig(schema, values)) {
    const issuePath = `${issue.code === 'requiredAlternatives' ? 'alt:' : ''}${issue.path.join('.')}`
    const message = issueMessage(issue, schema, values)
    if (
      !message ||
      reported.has(issuePath) ||
      !isDeclaredRequirement(issue, schema)
    ) {
      continue
    }
    reported.add(issuePath)
    errors.push({ path: errorPath(issue), message })
  }
  return errors
}

function alternativesOf(issue: ConfigIssue): string[][] {
  const alternatives = issue.params?.alternatives
  return Array.isArray(alternatives) ? (alternatives as string[][]) : []
}

function errorPath(issue: ConfigIssue): string {
  const path = issue.path.join('.')
  if (issue.code !== 'requiredAlternatives') {
    return path
  }
  const [firstKey] = alternativesOf(issue)[0] ?? []
  return firstKey === undefined ? path : joinPath(path, firstKey)
}

// Schema fields fully replace their stored values, but stored keys the schema
// does not know about are preserved. Empty optional fields are dropped so the
// manifest's own defaults stay authoritative instead of persisting ''.
export function mergeConfigValues(
  stored: Record<string, unknown>,
  config: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(stored)) {
    if (!(key in config)) {
      out[key] = value
    }
  }
  for (const [key, value] of Object.entries(config)) {
    if (value !== '' && value !== undefined) {
      out[key] = value
    }
  }
  return out
}
