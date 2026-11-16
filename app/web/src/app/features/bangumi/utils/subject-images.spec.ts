import {
  preferredCover,
  preferredPoster,
  preferredThumbnail,
} from './subject-images'

/**
 * Posters keep the largest cover and cards take the 400px one. Thumbnails
 * pick by the width encoded in the URL, because the v0 and next Bangumi APIs
 * hand out different widths under the same variant names: a slot gets the
 * smallest uncropped variant that is at least twice its CSS width, else the
 * widest one available. Square crops only serve when nothing else exists,
 * unsized letter paths never pass as the original, and a missing image set
 * never produces a broken URL.
 */

const images = {
  large: 'https://lain.bgm.tv/large.jpg',
  common: 'https://lain.bgm.tv/common.jpg',
  medium: 'https://lain.bgm.tv/medium.jpg',
  small: 'https://lain.bgm.tv/small.jpg',
  grid: 'https://lain.bgm.tv/grid.jpg',
}

const nextSubject = {
  large: 'https://lain.bgm.tv/pic/cover/l/cover.jpg',
  common: 'https://lain.bgm.tv/r/400/pic/cover/l/cover.jpg',
  medium: 'https://lain.bgm.tv/r/200/pic/cover/l/cover.jpg',
  small: 'https://lain.bgm.tv/r/100/pic/cover/l/cover.jpg',
  grid: 'https://lain.bgm.tv/r/100x100/pic/cover/l/cover.jpg',
}

const nextPerson = {
  large: 'https://lain.bgm.tv/pic/crt/l/person.jpg?r=1',
  medium: 'https://lain.bgm.tv/r/200/pic/crt/l/person.jpg?r=1',
  small: 'https://lain.bgm.tv/r/100/pic/crt/l/person.jpg?r=1',
  grid: 'https://lain.bgm.tv/r/100x100/pic/crt/l/person.jpg?r=1',
}

const v0Subject = {
  large: 'https://lain.bgm.tv/pic/cover/l/cover.jpg',
  common: 'https://lain.bgm.tv/r/400/pic/cover/l/cover.jpg',
  medium: 'https://lain.bgm.tv/r/800/pic/cover/l/cover.jpg',
  small: 'https://lain.bgm.tv/r/200/pic/cover/l/cover.jpg',
  grid: 'https://lain.bgm.tv/r/100/pic/cover/l/cover.jpg',
}

const letterSubject = {
  large: 'https://lain.bgm.tv/pic/cover/l/cover.jpg',
  common: 'https://lain.bgm.tv/pic/cover/c/cover.jpg',
  medium: 'https://lain.bgm.tv/pic/cover/m/cover.jpg',
  small: 'https://lain.bgm.tv/pic/cover/s/cover.jpg',
  grid: 'https://lain.bgm.tv/pic/cover/g/cover.jpg',
}

const letterPerson = {
  large: 'https://lain.bgm.tv/pic/crt/l/person.jpg',
  medium: 'https://lain.bgm.tv/pic/crt/m/person.jpg',
  small: 'https://lain.bgm.tv/pic/crt/s/person.jpg',
  grid: 'https://lain.bgm.tv/pic/crt/g/person.jpg',
}

describe('subject image variants', () => {
  it('keeps the full-size cover for detail posters', () => {
    expect(preferredPoster(images)).toBe('https://lain.bgm.tv/large.jpg')
  })

  it('prefers the 400px cover for cards', () => {
    expect(preferredCover(images)).toBe('https://lain.bgm.tv/common.jpg')
  })

  it('falls back to a larger cover when the 400px one is missing', () => {
    expect(preferredCover({ large: images.large })).toBe(images.large)
  })

  it('falls back to a smaller variant when the poster cover is missing', () => {
    expect(preferredPoster({ common: images.common })).toBe(images.common)
    expect(preferredPoster({ medium: images.medium })).toBe(images.medium)
  })

  it('returns an empty string for a missing image set', () => {
    expect(preferredPoster(undefined)).toBe('')
    expect(preferredPoster(null)).toBe('')
    expect(preferredCover(undefined)).toBe('')
    expect(preferredCover(null)).toBe('')
  })
})

describe('preferredThumbnail', () => {
  it('picks the 200px next API cover for an 80px slot', () => {
    expect(preferredThumbnail(nextSubject, 80)).toBe(nextSubject.medium)
  })

  it('picks the 200px v0 cover for a 64px slot', () => {
    expect(preferredThumbnail(v0Subject, 64)).toBe(v0Subject.small)
  })

  it('picks the 200px portrait for 64px and 96px slots', () => {
    expect(preferredThumbnail(nextPerson, 64)).toBe(nextPerson.medium)
    expect(preferredThumbnail(nextPerson, 96)).toBe(nextPerson.medium)
  })

  it('steps up to the 400px cover for a wider slot', () => {
    expect(preferredThumbnail(nextSubject, 150)).toBe(nextSubject.common)
  })

  it('takes the original when no resized variant is wide enough', () => {
    expect(preferredThumbnail(nextSubject, 300)).toBe(nextSubject.large)
  })

  it('takes the largest variant available when none reaches twice the slot', () => {
    expect(
      preferredThumbnail(
        { small: nextSubject.small, grid: nextSubject.grid },
        80
      )
    ).toBe(nextSubject.small)
  })

  it('skips the square crop when it would be the sharpest fit', () => {
    const images = {
      small: 'https://lain.bgm.tv/r/100/pic/cover/l/cover.jpg',
      grid: 'https://lain.bgm.tv/r/200x200/pic/cover/l/cover.jpg',
    }

    expect(preferredThumbnail(images, 80)).toBe(images.small)
  })

  it('skips the square crop when it would be the widest', () => {
    const images = {
      small: 'https://lain.bgm.tv/r/100/pic/cover/l/cover.jpg',
      grid: 'https://lain.bgm.tv/r/100x100/pic/cover/l/cover.jpg',
    }

    expect(preferredThumbnail(images, 80)).toBe(images.small)
  })

  it('uses the square crop when it is the only variant', () => {
    expect(preferredThumbnail({ grid: nextSubject.grid }, 80)).toBe(
      nextSubject.grid
    )
  })

  it('does not hand a thumbnail the original when only letter paths exist', () => {
    expect(preferredThumbnail(letterSubject, 64)).toBe(letterSubject.medium)
    expect(preferredThumbnail(letterSubject, 80)).toBe(letterSubject.medium)
    expect(preferredThumbnail(letterPerson, 64)).toBe(letterPerson.medium)
    expect(preferredThumbnail(letterPerson, 96)).toBe(letterPerson.medium)
  })

  it('steps a letter path up to the common size for a wider slot', () => {
    expect(preferredThumbnail(letterSubject, 150)).toBe(letterSubject.common)
  })

  it('treats a URL without a size segment as the original', () => {
    expect(preferredThumbnail({ grid: 'https://example.com/a.jpg' }, 80)).toBe(
      'https://example.com/a.jpg'
    )
  })

  it('returns an empty string for a missing image set', () => {
    expect(preferredThumbnail(undefined, 80)).toBe('')
    expect(preferredThumbnail(null, 80)).toBe('')
  })

  it('returns an empty string when a person has no photo', () => {
    expect(
      preferredThumbnail({ large: '', medium: '', small: '', grid: '' }, 96)
    ).toBe('')
  })
})
