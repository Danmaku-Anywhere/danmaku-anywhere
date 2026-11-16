export interface SubjectImageSet {
  large?: string
  common?: string
  medium?: string
  small?: string
  grid?: string
}

export const COVER_FALLBACK = 'assets/cover_fallback.webp'

// Detail headers and the video player show the poster large, so it keeps the
// largest variant.
export function preferredPoster(
  images: SubjectImageSet | null | undefined
): string {
  return images?.large || images?.common || images?.medium || ''
}

export function preferredCover(
  images: SubjectImageSet | null | undefined
): string {
  return images?.common || images?.medium || images?.large || ''
}

// Bangumi encodes a resized variant's width in its URL (r/200/, r/100x100/)
// and leaves the original without that segment. The v0 and next APIs hand
// out different widths under the same variant names (medium is 200px on
// next and 800px on v0), so thumbnails pick by width instead: the smallest
// uncropped variant that is at least twice the slot, for 2x screens, else
// the widest. A square crop is only used when it is all there is.
export function preferredThumbnail(
  images: SubjectImageSet | null | undefined,
  slotWidth: number
): string {
  const variants = [
    images?.grid,
    images?.small,
    images?.medium,
    images?.common,
    images?.large,
  ]
    .filter((url): url is string => !!url)
    .map(describeVariant)
  const uncropped = variants.filter((variant) => !variant.crop)
  const pool = uncropped.length > 0 ? uncropped : variants

  let sharp: ImageVariant | undefined
  let widest: ImageVariant | undefined
  for (const variant of pool) {
    if (!widest || variant.width > widest.width) {
      widest = variant
    }
    const fitsSlot = variant.width >= slotWidth * 2
    if (fitsSlot && (!sharp || variant.width < sharp.width)) {
      sharp = variant
    }
  }
  const chosen = sharp ?? widest
  return chosen ? chosen.url : ''
}

interface ImageVariant {
  url: string
  width: number
  crop: boolean
}

// Older records name the size with a letter (pic/cover/m/) instead of a
// width. Neither API returns those today, so the widths are approximate and
// only there to keep such a URL from passing as the full-size original.
const LETTER_WIDTHS: Record<string, number> = {
  g: 100,
  s: 100,
  m: 200,
  c: 400,
}

function describeVariant(url: string): ImageVariant {
  const resized = /\/r\/(\d+)(x\d+)?\//.exec(url)
  if (resized) {
    return { url, width: Number(resized[1]), crop: resized[2] !== undefined }
  }
  const letter = /\/pic\/[a-z]+\/([gsmc])\//.exec(url)
  if (letter) {
    return { url, width: LETTER_WIDTHS[letter[1]], crop: letter[1] === 'g' }
  }
  return { url, width: Number.POSITIVE_INFINITY, crop: false }
}
