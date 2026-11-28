import { EntityDecoder } from '@nodable/entities'
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser'

const ATTRIBUTES = '_attributes'
const TEXT = '_text'

function createParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    attributesGroupName: ATTRIBUTES,
    textNodeName: TEXT,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    alwaysCreateTextNode: true,
    tagValueProcessor: (_name, value) => {
      return value.trim() === '' ? '' : value
    },
    entityDecoder: new EntityDecoder({
      numericAllowed: true,
      namedEntities: {},
    }),
  })
}

export function parseXml(xml: string) {
  const source = xml.trimStart()
  const validation = XMLValidator.validate(source)
  if (validation !== true) {
    throw new Error(validation.err.msg)
  }

  const {
    '?xml': declaration,
    [TEXT]: _rootText,
    ...root
  } = createParser().parse(source)

  if (!declaration) {
    return root
  }
  return {
    _declaration: { [ATTRIBUTES]: declaration[ATTRIBUTES] },
    ...root,
  }
}

export function buildXml(document: object) {
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    attributesGroupName: ATTRIBUTES,
    textNodeName: TEXT,
    format: true,
    indentBy: '    ',
    suppressEmptyNode: false,
  }).build(document)
}
