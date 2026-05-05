import { useEffect, useRef, useState } from 'react'
import './App.css'

type Position =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'

type ColorMode = 'original' | 'custom'
type WatermarkMode = 'single' | 'pattern'

type LoadedImageAsset = {
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

const createImageAsset = (file: File): LoadedImageAsset => ({
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
  angleDegrees = 0,
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
  angleDegrees?: number
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
  context.translate(x + width / 2, y + height / 2)
  context.rotate((angleDegrees * Math.PI) / 180)

  if (colorMode === 'custom') {
    const tintCanvas = document.createElement('canvas')
    tintCanvas.width = Math.max(1, Math.round(width))
    tintCanvas.height = Math.max(1, Math.round(height))
    const tintContext = tintCanvas.getContext('2d')

    if (!tintContext) {
      context.drawImage(watermarkImage, -width / 2, -height / 2, width, height)
      context.restore()
      return
    }

    tintContext.drawImage(watermarkImage, 0, 0, width, height)
    tintContext.globalCompositeOperation = 'source-in'
    tintContext.fillStyle = watermarkColor
    tintContext.fillRect(0, 0, width, height)
    context.drawImage(tintCanvas, -width / 2, -height / 2)
  } else {
    context.drawImage(watermarkImage, -width / 2, -height / 2, width, height)
  }

  context.restore()
}

const renderWatermarkPattern = ({
  angleDegrees,
  colorMode,
  context,
  gapXPercent,
  gapYPercent,
  opacityPercent,
  outputHeight,
  outputWidth,
  targetHeight,
  targetWidth,
  watermarkColor,
  watermarkImage,
}: {
  angleDegrees: number
  colorMode: ColorMode
  context: CanvasRenderingContext2D
  gapXPercent: number
  gapYPercent: number
  opacityPercent: number
  outputHeight: number
  outputWidth: number
  targetHeight: number
  targetWidth: number
  watermarkColor: string
  watermarkImage: HTMLImageElement
}) => {
  const baseMeasure = Math.min(outputWidth, outputHeight)
  const gapX = Math.round((baseMeasure * gapXPercent) / 100)
  const gapY = Math.round((baseMeasure * gapYPercent) / 100)
  const stepX = Math.max(1, targetWidth + gapX)
  const stepY = Math.max(1, targetHeight + gapY)
  const rotationPadding = Math.ceil(Math.hypot(targetWidth, targetHeight))
  const startX = -stepX - rotationPadding
  const endX = outputWidth + stepX + rotationPadding
  const startY = -stepY - rotationPadding
  const endY = outputHeight + stepY + rotationPadding

  for (let y = startY; y <= endY; y += stepY) {
    for (let x = startX; x <= endX; x += stepX) {
      renderWatermark({
        angleDegrees,
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
  }
}

const drawComposition = ({
  angleDegrees,
  canvas,
  colorMode,
  marginPercent,
  opacityPercent,
  outputHeight,
  outputWidth,
  patternGapXPercent,
  patternGapYPercent,
  sourceMedia,
  position,
  sizePercent,
  watermarkMode,
  watermarkColor,
  watermarkImage,
}: {
  angleDegrees: number
  canvas: HTMLCanvasElement
  colorMode: ColorMode
  marginPercent: number
  opacityPercent: number
  outputHeight: number
  outputWidth: number
  patternGapXPercent: number
  patternGapYPercent: number
  sourceMedia: CanvasImageSource
  position: Position
  sizePercent: number
  watermarkMode: WatermarkMode
  watermarkColor: string
  watermarkImage: HTMLImageElement | null
}) => {
  const context = canvas.getContext('2d')
  if (!context) return

  canvas.width = outputWidth
  canvas.height = outputHeight

  context.clearRect(0, 0, outputWidth, outputHeight)
  context.drawImage(sourceMedia, 0, 0, outputWidth, outputHeight)

  if (!watermarkImage) return

  const targetWidth = Math.round((outputWidth * sizePercent) / 100)
  const ratio = watermarkImage.naturalHeight / watermarkImage.naturalWidth
  const targetHeight = Math.max(1, Math.round(targetWidth * ratio))

  if (watermarkMode === 'pattern') {
    renderWatermarkPattern({
      angleDegrees,
      colorMode,
      context,
      gapXPercent: patternGapXPercent,
      gapYPercent: patternGapYPercent,
      opacityPercent,
      outputHeight,
      outputWidth,
      targetHeight,
      targetWidth,
      watermarkColor,
      watermarkImage,
    })
    return
  }

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
  const [photoAsset, setPhotoAsset] = useState<LoadedImageAsset | null>(null)
  const [watermarkAsset, setWatermarkAsset] = useState<LoadedImageAsset | null>(null)
  const [watermarkMode, setWatermarkMode] = useState<WatermarkMode>('single')
  const [position, setPosition] = useState<Position>('bottom-right')
  const [sizePercent, setSizePercent] = useState(22)
  const [opacityPercent, setOpacityPercent] = useState(45)
  const [marginPercent, setMarginPercent] = useState(4)
  const [angleDegrees, setAngleDegrees] = useState(-25)
  const [patternGapXPercent, setPatternGapXPercent] = useState(12)
  const [patternGapYPercent, setPatternGapYPercent] = useState(10)
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
      asset: LoadedImageAsset | null,
      setter: (value: LoadedImageAsset | null) => void,
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
      angleDegrees,
      canvas,
      colorMode,
      marginPercent,
      opacityPercent,
      outputHeight: height,
      outputWidth: width,
      patternGapXPercent,
      patternGapYPercent,
      sourceMedia: photoAsset.image,
      position,
      sizePercent,
      watermarkMode,
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
    angleDegrees,
    patternGapXPercent,
    patternGapYPercent,
    watermarkMode,
    colorMode,
    watermarkColor,
  ])

  const updateAsset = (
    file: File | undefined,
    currentAsset: LoadedImageAsset | null,
    setter: (value: LoadedImageAsset | null) => void,
  ) => {
    if (!file) return
    if (currentAsset) URL.revokeObjectURL(currentAsset.url)
    setter(createImageAsset(file))
  }

  const handleDownload = async () => {
    if (!photoAsset?.image) return

    setIsDownloading(true)

    try {
      const canvas = document.createElement('canvas')
      const mimeType = getMimeType(photoAsset.file)

      drawComposition({
        angleDegrees,
        canvas,
        colorMode,
        marginPercent,
        opacityPercent,
        outputHeight: photoAsset.image.naturalHeight,
        outputWidth: photoAsset.image.naturalWidth,
        patternGapXPercent,
        patternGapYPercent,
        sourceMedia: photoAsset.image,
        position,
        sizePercent,
        watermarkMode,
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
          <p className="eyebrow">Marca de agua online sin perder resolución</p>
          <h1>Marca de agua online gratis para fotos</h1>
          <p className="lead">
            Sube una imagen base y un logo o sello, ajusta posición, tamaño,
            color y opacidad, y descarga el archivo final con las dimensiones
            originales directamente desde tu navegador.
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
              <span>Modo de marca</span>
              <select
                value={watermarkMode}
                onChange={(event) =>
                  setWatermarkMode(event.target.value as WatermarkMode)
                }
              >
                <option value="single">Una sola marca</option>
                <option value="pattern">Repetir por toda la foto</option>
              </select>
            </label>

            <label className="field">
              <span>Posición</span>
              <select
                value={position}
                disabled={watermarkMode === 'pattern'}
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
                disabled={watermarkMode === 'pattern'}
                onChange={(event) => setMarginPercent(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Ángulo del patrón: {angleDegrees}°</span>
              <input
                type="range"
                min="-90"
                max="90"
                value={angleDegrees}
                disabled={watermarkMode !== 'pattern'}
                onChange={(event) => setAngleDegrees(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Distancia horizontal: {patternGapXPercent}%</span>
              <input
                type="range"
                min="0"
                max="40"
                value={patternGapXPercent}
                disabled={watermarkMode !== 'pattern'}
                onChange={(event) =>
                  setPatternGapXPercent(Number(event.target.value))
                }
              />
            </label>

            <label className="field">
              <span>Distancia vertical: {patternGapYPercent}%</span>
              <input
                type="range"
                min="0"
                max="40"
                value={patternGapYPercent}
                disabled={watermarkMode !== 'pattern'}
                onChange={(event) =>
                  setPatternGapYPercent(Number(event.target.value))
                }
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

      <section className="seo-content" aria-labelledby="seo-title">
        <div>
          <p className="eyebrow seo-eyebrow">Protege tus fotos en segundos</p>
          <h2 id="seo-title">Herramienta para poner marca de agua a imágenes</h2>
          <p>
            Watermark te permite agregar una marca de agua a fotos, diseños,
            capturas y piezas comerciales sin instalar programas. Todo el
            proceso ocurre en el navegador: eliges la imagen principal, subes tu
            logo, firma o sello, revisas la vista previa y descargas el
            resultado en alta calidad.
          </p>
        </div>

        <div className="seo-grid">
          <article>
            <h3>Marca única o repetida</h3>
            <p>
              Coloca una marca en una esquina, en el centro o repítela como
              patrón para proteger catálogos, portafolios y publicaciones.
            </p>
          </article>
          <article>
            <h3>Control visual preciso</h3>
            <p>
              Ajusta tamaño, margen, opacidad, color y ángulo para que la marca
              de agua sea visible sin arruinar la imagen original.
            </p>
          </article>
          <article>
            <h3>Privado y rápido</h3>
            <p>
              Las imágenes se procesan localmente en tu dispositivo, con vista
              previa en tiempo real y descarga en la resolución original.
            </p>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
