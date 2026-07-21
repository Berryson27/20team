import QrScanner from 'qr-scanner'

type DecodeProgress = (message: string) => void

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('촬영한 이미지를 불러오지 못했습니다.'))
    }
    image.src = url
  })
}

function drawScaled(image: HTMLImageElement, scale: number, filter = 'none') {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('이미지를 처리할 수 없습니다.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = filter
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  context.filter = 'none'
  return canvas
}

function drawCenterCrop(image: HTMLImageElement) {
  const cropSize = Math.round(Math.min(image.naturalWidth, image.naturalHeight) * 0.9)
  const sourceX = Math.round((image.naturalWidth - cropSize) / 2)
  const sourceY = Math.round((image.naturalHeight - cropSize) / 2)
  const targetSize = Math.min(900, cropSize)
  const canvas = document.createElement('canvas')
  canvas.width = targetSize
  canvas.height = targetSize
  const context = canvas.getContext('2d')
  if (!context) throw new Error('이미지를 처리할 수 없습니다.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, targetSize, targetSize)
  return canvas
}

function applyOtsuThreshold(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return canvas
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const histogram = new Uint32Array(256)
  let luminanceSum = 0

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = Math.round(pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114)
    histogram[luminance] += 1
    luminanceSum += luminance
  }

  const pixelCount = pixels.length / 4
  let backgroundWeight = 0
  let backgroundSum = 0
  let bestVariance = -1
  let threshold = 128

  for (let value = 0; value < 256; value += 1) {
    backgroundWeight += histogram[value]
    if (backgroundWeight === 0) continue
    const foregroundWeight = pixelCount - backgroundWeight
    if (foregroundWeight === 0) break
    backgroundSum += value * histogram[value]
    const backgroundMean = backgroundSum / backgroundWeight
    const foregroundMean = (luminanceSum - backgroundSum) / foregroundWeight
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      threshold = value
    }
  }

  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114
    const output = luminance > threshold ? 255 : 0
    pixels[index] = output
    pixels[index + 1] = output
    pixels[index + 2] = output
  }
  context.putImageData(imageData, 0, 0)
  return canvas
}

async function scan(source: File | HTMLCanvasElement) {
  return QrScanner.scanImage(source, { returnDetailedScanResult: true })
}

export async function decodeQrImage(file: File, onProgress?: DecodeProgress) {
  onProgress?.('원본 사진에서 QR을 찾고 있어요.')
  try {
    return await scan(file)
  } catch {
    // Monitor photos often need pixel averaging before their modules can be decoded.
  }

  const image = await loadImage(file)
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
  const scales = [
    Math.min(0.75, 1600 / longestSide),
    Math.min(0.5, 1000 / longestSide),
  ].filter((scale, index, values) => scale > 0 && values.indexOf(scale) === index)

  for (const scale of scales) {
    onProgress?.('모니터 촬영 노이즈를 줄여 다시 확인해요.')
    const canvas = drawScaled(image, scale)
    try {
      return await scan(canvas)
    } catch {
      // Continue with the next scale.
    }
  }

  onProgress?.('QR의 명암과 경계를 선명하게 보정하고 있어요.')
  const thresholdScale = Math.min(0.75, 1200 / longestSide)
  const thresholdCanvas = applyOtsuThreshold(drawScaled(image, thresholdScale, 'grayscale(1) blur(0.6px) contrast(1.15)'))
  try {
    return await scan(thresholdCanvas)
  } catch {
    // A centered crop is the final fallback for photos with large margins.
  }

  onProgress?.('QR 주변만 집중해서 마지막으로 확인해요.')
  return scan(drawCenterCrop(image))
}
