import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { zGenericXml } from '../schema/index.js'
import { commentsToXml } from './commentsToXml.js'
import { xmlToJSON } from './index.js'

/**
 * Pins the XML boundary of danmaku-model: xmlToJSON output shape for
 * bilibili-style files, and that commentsToXml output survives a trip back
 * through xmlToJSON and zGenericXml with text and attributes intact.
 */

function dFile(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<i>${body}</i>`
}

function textOf(xml: string) {
  const parsed = xmlToJSON(xml)
  return parsed.i.d._text as string
}

describe('xmlToJSON', () => {
  it('keeps the declaration and root fields', () => {
    const result = xmlToJSON(
      '<?xml version="1.0" encoding="UTF-8"?>\n<i><chatid>12</chatid><d p="1,1,25,1">a</d></i>'
    )
    expect(result).toEqual({
      _declaration: { _attributes: { version: '1.0', encoding: 'UTF-8' } },
      i: {
        chatid: { _text: '12' },
        d: { _attributes: { p: '1,1,25,1' }, _text: 'a' },
      },
    })
  })

  it('tolerates whitespace before the declaration', () => {
    const result = xmlToJSON('\n  <?xml version="1.0"?>\n<i><d p="1">a</d></i>')
    expect(result.i.d).toEqual({ _attributes: { p: '1' }, _text: 'a' })
  })

  it('returns an array for many d elements, an object for a single one', () => {
    const many = xmlToJSON(dFile('<d p="1">a</d><d p="2">b</d><d p="3">c</d>'))
    expect(many.i.d).toEqual([
      { _attributes: { p: '1' }, _text: 'a' },
      { _attributes: { p: '2' }, _text: 'b' },
      { _attributes: { p: '3' }, _text: 'c' },
    ])
    const one = xmlToJSON(dFile('<d p="1">a</d>'))
    expect(one.i.d).toEqual({ _attributes: { p: '1' }, _text: 'a' })
  })

  it('keeps CJK and non-BMP text', () => {
    expect(textOf(dFile('<d p="1">中文弹幕😀👨‍👩‍👧</d>'))).toBe(
      '中文弹幕😀👨‍👩‍👧'
    )
  })

  it('decodes the five predefined entities', () => {
    expect(textOf(dFile('<d p="1">&amp; &lt; &gt; &quot; &apos;</d>'))).toBe(
      '& < > " \''
    )
  })

  it('decodes numeric character references', () => {
    expect(textOf(dFile('<d p="1">&#65;&#x41;&#x1F600;&#128512;</d>'))).toBe(
      'AA😀😀'
    )
  })

  it('does not decode a doubly escaped ampersand twice', () => {
    expect(textOf(dFile('<d p="1">&amp;amp; &amp;#65;</d>'))).toBe(
      '&amp; &#65;'
    )
  })

  it('decodes entities in attributes', () => {
    const result = xmlToJSON(
      dFile('<d p="a &amp; b &lt; &quot;q&quot; &#65;,1">x</d>')
    )
    expect(result.i.d._attributes.p).toBe('a & b < "q" A,1')
  })

  it('keeps commas in attributes and leading/trailing whitespace in text', () => {
    const result = xmlToJSON(
      dFile('<d p="1.5,1,25,16777215,0,0,0,0">  sp  </d>')
    )
    expect(result.i.d._attributes.p).toBe('1.5,1,25,16777215,0,0,0,0')
    expect(result.i.d._text).toBe('  sp  ')
  })

  it('keeps numeric-looking text as strings', () => {
    const result = xmlToJSON(dFile('<d p="1">1</d><d p="2">true</d>'))
    expect(result.i.d.map((d: { _text: string }) => d._text)).toEqual([
      '1',
      'true',
    ])
  })

  it('yields no text for empty d elements', () => {
    const result = xmlToJSON(dFile('<d p="1"></d><d p="2"/>'))
    for (const d of result.i.d) {
      expect(d._text ?? '').toBe('')
    }
  })

  it('parses the e2e bilibili fixture end to end', async () => {
    const xml = readFileSync(
      new URL(
        '../../../danmaku-anywhere/e2e/fixtures/bilibili-xml.xml',
        import.meta.url
      ),
      'utf8'
    )
    const result = await zGenericXml.parseAsync(xml)
    expect(result).toEqual([
      { p: '12.34,1,16777215', m: '第一条' },
      { p: '23.45,4,16711680', m: '底部弹幕' },
      { p: '34.56,5,255', m: '顶部蓝色' },
    ])
  })

  it('keeps named entities other than the predefined five as literal text', () => {
    expect(textOf(dFile('<d p="1">a&nbsp;b &copy;</d>'))).toBe(
      'a&nbsp;b &copy;'
    )
  })

  it('rejects truncated xml', () => {
    expect(() => xmlToJSON('<i><d p="1">a</d>')).toThrow()
  })

  it('rejects text that is not xml', () => {
    expect(() => xmlToJSON('not xml')).toThrow()
  })
})

describe('commentsToXml round trip', () => {
  it('keeps an already escaped looking ampersand sequence', () => {
    const text = '&amp; &lt; &#65;'
    const xml = commentsToXml([{ p: '12,1,16777215', m: text }])
    expect(xmlToJSON(xml).i.d._text).toBe(text)
  })

  const texts = [
    '普通弹幕',
    '😀 emoji 👨‍👩‍👧 𠮷',
    'a & b < c > d "quoted" \'single\'',
    '&nbsp; and &#65; are plain characters here',
    '  leading and trailing  ',
    'tab\tinside',
  ]

  it.each(texts)('keeps text %j', (text) => {
    const xml = commentsToXml([{ p: '12,1,16777215', m: text }])
    expect(xmlToJSON(xml).i.d._text).toBe(text)
  })

  it('keeps p attributes with commas', () => {
    const xml = commentsToXml([{ p: '12,5,255,42', m: 'x' }])
    expect(xmlToJSON(xml).i.d._attributes.p).toBe('12,5,25,255,42,0,0,0')
  })

  it('round trips many comments through the schema', async () => {
    const comments = Array.from({ length: 300 }, (_, i) => ({
      p: `${i},${[1, 4, 5][i % 3]},${i * 1000}`,
      m: `${texts[i % texts.length]} ${i}`,
    }))
    const parsed = await zGenericXml.parseAsync(commentsToXml(comments))
    expect(parsed).toEqual(comments)
  })

  it('writes a single comment that can be read back', () => {
    const xml = commentsToXml([{ p: '12,1,16777215', m: 'only' }])
    expect(xmlToJSON(xml).i.d).toEqual({
      _attributes: { p: '12,1,25,16777215,0,0,0,0' },
      _text: 'only',
    })
  })

  it('writes an empty comment without text', () => {
    const xml = commentsToXml([{ p: '12,1,16777215', m: '' }])
    expect(xml).toMatch(/<d p="12,1,25,16777215,0,0,0,0"(><\/d>|\s*\/>)/)
  })

  it('writes the declaration and header fields', () => {
    const xml = commentsToXml([{ p: '1,1,16777215', m: 'a' }])
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    const parsed = xmlToJSON(xml).i
    expect(parsed.chatserver._text).toBe('chat.bilibili.com')
    expect(parsed.chatid._text).toBe('0')
    expect(parsed.maxlimit._text).toBe('1')
    expect(parsed.source._text).toBe('k-v')
  })
})
