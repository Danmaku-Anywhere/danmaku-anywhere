import type { ManifestIncompatibility } from '@mr-quin/dango'
import type { TFunction } from 'i18next'

export function incompatibilityMessage(
  t: TFunction,
  incompatibility: ManifestIncompatibility
): string {
  if (incompatibility.reason === 'engine-version') {
    return t(
      'providers.incompatible.engineVersion',
      'Needs engine {{version}} or newer. Update the extension to use it.',
      { version: incompatibility.minEngineVersion }
    )
  }
  return t(
    'providers.incompatible.apiVersion',
    'Uses API version {{version}}, which this version of the extension does not support.',
    { version: incompatibility.apiVersion }
  )
}
