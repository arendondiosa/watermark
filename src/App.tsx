import { useEffect, useRef, useState } from 'react'
import './App.css'

type Position =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'

type ColorMode = 'original' | 'custom'

type LoadedAsset = {
  file: File
  url: string
  image: HTMLImageElement | null
}

const positions: Array<{ value: Position; label: string }> = [
  { value: 'top-left', label: 'Esquina superior izquierda' },
  { value: 'top-right', label: 'Esquina superior derecha' },
  { value: 'bottom-left', label: 'Esquina inferior izquierda' },
  { value: 'bottom-right', label: 'Esquina inferior derecha' },
  { value: 'center', label: 'Centro' },
]

const createAsset = (file: File): LoadedAsset => ({
  file,
  url: URL.createObjectURL(file),
  image: null,
})

const loadImage = async (url: string) => {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

const getMimeType = (file: File | null) => {
  if (!file) return 'image/png'
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return file.type
  }
  return 'image/png'
}

const getExtension = (mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'png'
  }
}

const fitDimensions = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) => {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

const getWatermarkPlacement = (
  position: Position,
  marginPercent: number,
  baseWidth: number,
  baseHeight: number,
  markWidth: number,
  markHeight: number,
) => {
  const margin = Math.round((Math.min(baseWidth, baseHeight) * marginPercent) / 100)

  switch (position) {
    case 'top-left':
      return { x: margin, y: margin }
    case 'top-right':
      return { x: baseWidth - markWidth - margin, y: margin }
    case 'bottom-left':
      return { x: margin, y: baseHeight - markHeight - margin }
    case 'center':
      return {
        x: Math.round((baseWidth - markWidth) / 2),
        y: Math.round((baseHeight - markHeight) / 2),
      }
    case 'bottom-right':
    default:
      return {
        x: baseWidth - markWidth - margin,
        y: baseHeight - markHeight - margin,
      }
  }
}

const renderWatermark = ({
  colorMode,
  context,
  height,
  opacityPercent,
  watermarkColor,
  watermarkImage,
  width,
  x,
  y,
}: {
  colorMode: ColorMode
  context: CanvasRenderingContext2D
  height: number
  opacityPercent: number
  watermarkColor: string
  watermarkImage: HTMLImageElement
  width: number
  x: number
  y: number
}) => {
  context.save()
  context.globalAlpha = opacityPercent / 100

  if (colorMode === 'custom') {
    const tintCanvas = document.createElement('canvas')
    tintCanvas.width = Math.max(1, Math.round(width))
    tintCanvas.height = Math.max(1, Math.round(height))
    const tintContext = tintCanvas.getContext('2d')

    if (!tintContext) {
      context.drawImage(watermarkImage, x, y, width, height)
      context.restore()
      return
    }

    tintContext.drawImage(watermarkImage, 0, 0, width, height)
    tintContext.globalCompositeOperation = 'source-in'
    tintContext.fillStyle = watermarkColor
    tintContext.fillRect(0, 0, width, height)
    context.drawImage(tintCanvas, x, y)
  } else {
    context.drawImage(watermarkImage, x, y, width, height)
  }

  context.restore()
}

const drawComposition = ({
  canvas,
  colorMode,
  marginPercent,
  opacityPercent,
  outputHeight,
  outputWidth,
  photoImage,
  position,
  sizePercent,
  watermarkColor,
  watermarkImage,
}: {
  canvas: HTMLCanvasElement
  colorMode: ColorMode
  marginPercent: number
  opacityPercent: number
  outputHeight: number
  outputWidth: number
  photoImage: HTMLImageElement
  position: Position
  sizePercent: number
  watermarkColor: string
  watermarkImage: HTMLImageElement | null
}) => {
  const context = canvas.getContext('2d')
  if (!context) return

  canvas.width = outputWidth
  canvas.height = outputHeight

  context.clearRect(0, 0, outputWidth, outputHeight)
  context.drawImage(photoImage, 0, 0, outputWidth, outputHeight)

  if (!watermarkImage) return

  const targetWidth = Math.round((outputWidth * sizePercent) / 100)
  const ratio = watermarkImage.naturalHeight / watermarkImage.naturalWidth
  const targetHeight = Math.max(1, Math.round(targetWidth * ratio))
  const { x, y } = getWatermarkPlacement(
    position,
    marginPercent,
    outputWidth,
    outputHeight,
    targetWidth,
    targetHeight,
  )

  renderWatermark({
    colorMode,
    context,
    height: targetHeight,
    opacityPercent,
    watermarkColor,
    watermarkImage,
    width: targetWidth,
    x,
    y,
  })
}

function App() {
  const [photoAsset, setPhotoAsset] = useState<LoadedAsset | null>(null)
  const [watermarkAsset, setWatermarkAsset] = useState<LoadedAsset | null>(null)
  const [position, setPosition] = useState<Position>('bottom-right')
  const [sizePercent, setSizePercent] = useState(22)
  const [opacityPercent, setOpacityPercent] = useState(45)
  const [marginPercent, setMarginPercent] = useState(4)
  const [colorMode, setColorMode] = useState<ColorMode>('original')
  const [watermarkColor, setWatermarkColor] = useState('#ffffff')
  const [error, setError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    return () => {
      if (photoAsset) URL.revokeObjectURL(photoAsset.url)
      if (watermarkAsset) URL.revokeObjectURL(watermarkAsset.url)
    }
  }, [photoAsset, watermarkAsset])

  useEffect(() => {
    const hydrateAsset = async (
      asset: LoadedAsset | null,
      setter: (value: LoadedAsset | null) => void,
    ) => {
      if (!asset || asset.image) return

      try {
        const image = await loadImage(asset.url)
        setter({ ...asset, image })
        setError('')
      } catch {
        setError('No pudimos leer una de las imágenes. Intenta con otro archivo.')
      }
    }

    void hydrateAsset(photoAsset, setPhotoAsset)
    void hydrateAsset(watermarkAsset, setWatermarkAsset)
  }, [photoAsset, watermarkAsset])

  useEffect(() => {
    if (!previewCanvasRef.current || !photoAsset?.image) return

    const canvas = previewCanvasRef.current
    const { width, height } = fitDimensions(
      photoAsset.image.naturalWidth,
      photoAsset.image.naturalHeight,
      880,
      520,
    )

    drawComposition({
      canvas,
      colorMode,
      marginPercent,
      opacityPercent,
      outputHeight: height,
      outputWidth: width,
      photoImage: photoAsset.image,
      position,
      sizePercent,
      watermarkColor,
      watermarkImage: watermarkAsset?.image ?? null,
    })
  }, [
    photoAsset,
    watermarkAsset,
    position,
    sizePercent,
    opacityPercent,
    marginPercent,
    colorMode,
    watermarkColor,
  ])

  const updateAsset = (
    file: File | undefined,
    currentAsset: LoadedAsset | null,
    setter: (value: LoadedAsset | null) => void,
  ) => {
    if (!file) return
    if (currentAsset) URL.revokeObjectURL(currentAsset.url)
    setter(createAsset(file))
  }

  const handleDownload = async () => {
    if (!photoAsset?.image) return

    setIsDownloading(true)

    try {
      const canvas = document.createElement('canvas')
      const mimeType = getMimeType(photoAsset.file)

      drawComposition({
        canvas,
        colorMode,
        marginPercent,
        opacityPercent,
        outputHeight: photoAsset.image.naturalHeight,
        outputWidth: photoAsset.image.naturalWidth,
        photoImage: photoAsset.image,
        position,
        sizePercent,
        watermarkColor,
        watermarkImage: watermarkAsset?.image ?? null,
      })

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, 1),
      )

      if (!blob) {
        setError('No pudimos generar la descarga. Intenta de nuevo.')
        return
      }

      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const extension = getExtension(mimeType)
      const fileName = photoAsset.file.name.replace(/\.[^.]+$/, '')

      link.href = downloadUrl
      link.download = `${fileName}-watermark.${extension}`
      link.click()

      URL.revokeObjectURL(downloadUrl)
      setError('')
    } finally {
      setIsDownloading(false)
    }
  }

  const canRender = Boolean(photoAsset?.image)
  const canDownload = Boolean(photoAsset?.image && watermarkAsset?.image)

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Marca de agua sin perder resolución</p>
          <h1>Sube tu foto, aplica la marca y descarga el resultado final.</h1>
          <p className="lead">
            Carga una imagen base y una imagen para la marca de agua, ajusta
            posición, tamaño, color y opacidad, y descarga el archivo con las
            dimensiones originales.
          </p>
        </div>
      </section>

      <section className="workspace">
        <aside className="controls-panel">
          <div className="panel-block">
            <h2>Archivos</h2>
            <label className="upload-field">
              <span>Foto principal</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  updateAsset(
                    event.target.files?.[0],
                    photoAsset,
                    setPhotoAsset,
                  )
                }
              />
            </label>

            <label className="upload-field">
              <span>Marca de agua</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  updateAsset(
                    event.target.files?.[0],
                    watermarkAsset,
                    setWatermarkAsset,
                  )
                }
              />
            </label>
          </div>

          <div className="panel-block">
            <h2>Ajustes</h2>

            <label className="field">
              <span>Posición</span>
              <select
                value={position}
                onChange={(event) => setPosition(event.target.value as Position)}
              >
                {positions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Tamaño de la marca: {sizePercent}%</span>
              <input
                type="range"
                min="8"
                max="45"
                value={sizePercent}
                onChange={(event) => setSizePercent(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Opacidad: {opacityPercent}%</span>
              <input
                type="range"
                min="5"
                max="100"
                value={opacityPercent}
                onChange={(event) =>
                  setOpacityPercent(Number(event.target.value))
                }
              />
            </label>

            <label className="field">
              <span>Margen: {marginPercent}%</span>
              <input
                type="range"
                min="0"
                max="12"
                value={marginPercent}
                onChange={(event) => setMarginPercent(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Color de la marca</span>
              <select
                value={colorMode}
                onChange={(event) => setColorMode(event.target.value as ColorMode)}
              >
                <option value="original">Usar colores originales</option>
                <option value="custom">Aplicar un solo color</option>
              </select>
            </label>

            <label className="field">
              <span>Color personalizado</span>
              <input
                type="color"
                value={watermarkColor}
                disabled={colorMode !== 'custom'}
                onChange={(event) => setWatermarkColor(event.target.value)}
              />
            </label>
          </div>

          <div className="panel-block">
            <button
              className="primary-button"
              onClick={handleDownload}
              disabled={!canDownload || isDownloading}
            >
              {isDownloading ? 'Generando archivo...' : 'Descargar imagen final'}
            </button>
            <p className="hint">
              La descarga conserva la resolución original de la foto base.
            </p>
            {error ? <p className="error-message">{error}</p> : null}
          </div>
        </aside>

        <section className="preview-panel">
          <div className="preview-header">
            <div>
              <p className="preview-label">Vista previa</p>
              <h2>Resultado en tiempo real</h2>
            </div>
            {photoAsset?.image ? (
              <p className="resolution-pill">
                {photoAsset.image.naturalWidth} x {photoAsset.image.naturalHeight}px
              </p>
            ) : null}
          </div>

          <div className="preview-stage">
            {canRender ? (
              <canvas ref={previewCanvasRef} className="preview-canvas" />
            ) : (
              <div className="empty-state">
                <p>Sube la foto principal para empezar.</p>
                <span>Cuando cargues ambas imágenes verás el resultado aquí.</span>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
