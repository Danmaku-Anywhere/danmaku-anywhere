import { sakuraLight } from '@/common/theme/sakuraTokens'

const SOURCES = { 16: 'normal_16.png', 32: 'normal_32.png' } as const

type IconSize = keyof typeof SOURCES

async function drawWithDot(size: IconSize): Promise<ImageData> {
  const response = await fetch(chrome.runtime.getURL(SOURCES[size]))
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('OffscreenCanvas has no 2d context')
  }
  ctx.drawImage(bitmap, 0, 0, size, size)

  const radius = size * 0.2
  const center = size - radius - size * 0.03
  ctx.beginPath()
  ctx.arc(center, center, radius + size * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.fillStyle = sakuraLight.success.main
  ctx.fill()

  return ctx.getImageData(0, 0, size, size)
}

export async function drawMountedIcon(): Promise<Record<IconSize, ImageData>> {
  const [small, large] = await Promise.all([drawWithDot(16), drawWithDot(32)])
  return { 16: small, 32: large }
}
