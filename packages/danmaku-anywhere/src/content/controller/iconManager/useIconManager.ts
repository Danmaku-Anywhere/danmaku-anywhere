import { useEffect } from 'react'

import { chromeRpcClient } from '@/common/rpcClient/background/client'
import { useActiveConfig } from '@/content/controller/common/context/useActiveConfig'
import { useStore } from '@/content/controller/store/store'

export const useIconManager = () => {
  const config = useActiveConfig()
  const { isMounted } = useStore.use.danmaku()

  useEffect(() => {
    if (isMounted) {
      return void chromeRpcClient.iconSet({ state: 'active' })
    }
    return void chromeRpcClient.iconSet({ state: 'available' })
  }, [config, isMounted]) // config is included to ensure icon is reset when config changes
}
