import { Alert, AlertTitle, Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { IncompatibleManifestInfo } from '@/common/rpcClient/background/types'
import { incompatibilityMessage } from '../incompatibility'

interface IncompatibleManifestsCalloutProps {
  manifests: IncompatibleManifestInfo[]
}

export const IncompatibleManifestsCallout = ({
  manifests,
}: IncompatibleManifestsCalloutProps) => {
  const { t } = useTranslation()

  if (manifests.length === 0) {
    return null
  }

  return (
    <Alert severity="warning" sx={{ mb: 1 }}>
      <AlertTitle>
        {t(
          'providers.incompatible.title',
          'Some sources cannot run on this version'
        )}
      </AlertTitle>
      <Stack component="ul" sx={{ m: 0, pl: 2 }}>
        {manifests.map((manifest) => (
          <li key={manifest.id}>
            {manifest.name}:{' '}
            {incompatibilityMessage(t, manifest.incompatibility)}
          </li>
        ))}
      </Stack>
    </Alert>
  )
}
