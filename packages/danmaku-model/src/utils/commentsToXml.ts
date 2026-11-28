import type { CommentEntity } from '../canonical/index.js'
import { buildXml } from './xml.js'

/**
 * Convert comments to XML format compatible with DanDanPlay
 */
export const commentsToXml = (comments: CommentEntity[]) => {
  const xmlStructure = {
    '?xml': {
      _attributes: {
        version: '1.0',
        encoding: 'UTF-8',
      },
    },
    i: {
      chatserver: 'chat.bilibili.com',
      chatid: '0',
      mission: '0',
      maxlimit: comments.length.toString(),
      state: '0',
      real_name: '0',
      source: 'k-v',
      d: comments.map((comment) => {
        const pParts = comment.p.split(',')
        const [time, mode, color, ...rest] = pParts

        const uid = rest[0] || '0'

        return {
          _attributes: {
            p: [
              Number.parseInt(time, 10),
              mode,
              '25', // font size
              color,
              uid,
              '0', // unknown, but needed for compatibility
              '0', // unknown
              '0', // unknown
            ].join(','),
          },
          _text: comment.m,
        }
      }),
    },
  }

  return buildXml(xmlStructure)
}
