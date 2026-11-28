import type { ConfigSchema } from '@mr-quin/dango'
import { describe, expect, it, vi } from 'vitest'
import { validateConfigValues, validateScalar } from './schemaForm'

vi.mock('@/common/localization/i18n', () => ({
  i18n: {
    language: 'en',
    t: (key: string, _default: string, params?: Record<string, unknown>) => {
      return params ? `${key} ${JSON.stringify(params)}` : key
    },
  },
}))

/**
 * Pins every message the config form's validator can produce, with the values
 * interpolated into it, so the validator can change implementation without
 * users seeing different text. The mocked i18n renders the key followed by
 * its parameters.
 */

const PREFIX = 'providers.editor.validation'

function message(
  schema: ConfigSchema,
  values: Record<string, unknown>,
  path: string
): string | undefined {
  return validateConfigValues(
    { type: 'object', properties: { field: schema } },
    values
  ).find((error) => error.path === path)?.message
}

describe('validator messages', () => {
  it('required', () => {
    const schema: ConfigSchema = {
      type: 'object',
      required: ['a'],
      properties: { a: { type: 'string' } },
    }
    expect(validateConfigValues(schema, {})).toEqual([
      { path: 'a', message: `${PREFIX}.required` },
    ])
  })

  it('minLength and maxLength carry the bound', () => {
    const schema: ConfigSchema = { type: 'string', minLength: 2, maxLength: 4 }
    expect(validateScalar(schema, 'a')).toBe(`${PREFIX}.minLength {"min":2}`)
    expect(validateScalar(schema, 'abcde')).toBe(
      `${PREFIX}.maxLength {"max":4}`
    )
  })

  it('pattern carries the pattern', () => {
    const schema: ConfigSchema = { type: 'string', pattern: '^[a-z]+$' }
    expect(validateScalar(schema, 'A1')).toBe(
      `${PREFIX}.pattern {"pattern":"^[a-z]+$"}`
    )
  })

  it('url format, for both uri and url', () => {
    expect(validateScalar({ type: 'string', format: 'uri' }, 'nope')).toBe(
      `${PREFIX}.url`
    )
    expect(validateScalar({ type: 'string', format: 'url' }, 'nope')).toBe(
      `${PREFIX}.url`
    )
  })

  it('minimum and maximum carry the bound', () => {
    const schema: ConfigSchema = { type: 'number', minimum: 1, maximum: 10 }
    expect(validateScalar(schema, 0)).toBe(`${PREFIX}.minimum {"min":1}`)
    expect(validateScalar(schema, 11)).toBe(`${PREFIX}.maximum {"max":10}`)
  })

  it('integer', () => {
    expect(validateScalar({ type: 'integer' }, 1.5)).toBe(`${PREFIX}.integer`)
  })

  it('a non-finite number is not a whole number', () => {
    expect(validateScalar({ type: 'integer' }, Number.NaN)).toBe(
      `${PREFIX}.integer`
    )
  })

  it('reports one message per field, the first rule that fails', () => {
    const schema: ConfigSchema = {
      type: 'string',
      minLength: 5,
      pattern: '^[0-9]+$',
    }
    expect(validateScalar(schema, 'ab')).toBe(`${PREFIX}.minLength {"min":5}`)
    expect(
      validateConfigValues(
        { type: 'object', properties: { field: schema } },
        { field: 'ab' }
      )
    ).toHaveLength(1)
  })

  it('names the alternatives by field title, falling back to the key', () => {
    const schema: ConfigSchema = {
      type: 'object',
      anyOf: [{ required: ['baseUrl'] }, { required: ['appId', 'appSecret'] }],
      properties: {
        baseUrl: { type: 'string', title: 'Base URL' },
        appId: { type: 'string', title: 'App ID' },
        appSecret: { type: 'string' },
      },
    }
    expect(validateConfigValues(schema, {})).toEqual([
      {
        path: 'baseUrl',
        message: `${PREFIX}.requiredAlternatives {"fields":"Base URL or App ID and appSecret"}`,
      },
    ])
  })

  it('reports alternatives of a nested object under that object', () => {
    const schema: ConfigSchema = {
      type: 'object',
      properties: {
        server: {
          type: 'object',
          anyOf: [{ required: ['url'] }, { required: ['host'] }],
          properties: { url: { type: 'string' }, host: { type: 'string' } },
        },
      },
    }
    expect(
      validateConfigValues(schema, { server: { url: '', host: '' } })
    ).toMatchObject([{ path: 'server.url' }])
  })
})

describe('validator coverage of rules without a message', () => {
  it('ignores an invalid pattern regex', () => {
    expect(
      message({ type: 'string', pattern: '[' }, { field: 'x' }, 'field')
    ).toBe(undefined)
  })

  it('does not check enum membership', () => {
    const schema: ConfigSchema = { type: 'integer', enum: [0, 1] }
    expect(message(schema, { field: 7 }, 'field')).toBeUndefined()
  })

  it('does not check array length or additional properties', () => {
    const schema: ConfigSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        list: { type: 'array', minItems: 2, items: { type: 'string' } },
      },
    }
    expect(validateConfigValues(schema, { list: ['a'], extra: 1 })).toEqual([])
  })

  it('does not check the value type of a text field', () => {
    expect(message({ type: 'string' }, { field: 5 }, 'field')).toBeUndefined()
  })

  it('treats null, undefined and empty string as not set', () => {
    const schema: ConfigSchema = { type: 'string', minLength: 3 }
    for (const value of [null, undefined, '']) {
      expect(message(schema, { field: value }, 'field')).toBeUndefined()
    }
  })

  it('ignores required keys the schema does not declare as properties', () => {
    const schema: ConfigSchema = {
      type: 'object',
      required: ['ghost'],
      properties: { a: { type: 'string' } },
    }
    expect(validateConfigValues(schema, {})).toEqual([])
  })

  it('does not validate nested required keys of an object that is not set', () => {
    const schema: ConfigSchema = {
      type: 'object',
      properties: {
        auth: {
          type: 'object',
          required: ['key'],
          properties: { key: { type: 'string' } },
        },
      },
    }
    expect(validateConfigValues(schema, {})).toEqual([])
    expect(validateConfigValues(schema, { auth: {} })).toMatchObject([
      { path: 'auth.key' },
    ])
  })
})
