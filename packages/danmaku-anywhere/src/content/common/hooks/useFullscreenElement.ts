import { useEffect, useState } from 'react'
import { getDeepFullscreenElement } from '@/content/common/shadowDom/deepFullscreenElement'

export function useFullscreenElement(): Element | null {
  const [element, setElement] = useState(() =>
    getDeepFullscreenElement(document)
  )

  useEffect(() => {
    const handleChange = () => {
      setElement(getDeepFullscreenElement(document))
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
    }
  }, [])

  return element
}
