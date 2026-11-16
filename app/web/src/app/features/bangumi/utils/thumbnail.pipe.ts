import type { PipeTransform } from '@angular/core'
import { Pipe } from '@angular/core'
import type { SubjectImageSet } from './subject-images'
import { preferredThumbnail } from './subject-images'

@Pipe({
  name: 'daThumbnail',
})
export class ThumbnailPipe implements PipeTransform {
  transform(
    images: SubjectImageSet | null | undefined,
    slotWidth: number
  ): string {
    return preferredThumbnail(images, slotWidth)
  }
}
