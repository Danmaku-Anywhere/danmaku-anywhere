export interface SubjectImageSet {
  large?: string
  common?: string
  medium?: string
  small?: string
  grid?: string
}

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
// variant that is at least twice the slot, for 2x screens, else the largest.
export function preferredThumbnail(
  images: SubjectImageSet | null | undefined,
  slotWidth: number
): string {
  const candidates = [
    images?.large,
    images?.common,
    images?.medium,
    images?.small,
    images?.grid,
  ]
    .filter((url): url is string => !!url)
    .map((url) => {
      return { url, width: variantWidth(url) }
    })

  let sharp: ImageVariant | undefined
  let widest: ImageVariant | undefined
  for (const candidate of candidates) {
    if (!widest || candidate.width > widest.width) {
      widest = candidate
    }
    const fitsSlot = candidate.width >= slotWidth * 2
    if (fitsSlot && (!sharp || candidate.width < sharp.width)) {
      sharp = candidate
    }
  }
  const chosen = sharp ?? widest
  return chosen ? chosen.url : ''
}

interface ImageVariant {
  url: string
  width: number
}

function variantWidth(url: string): number {
  const match = /\/r\/(\d+)(?:x\d+)?\//.exec(url)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}
