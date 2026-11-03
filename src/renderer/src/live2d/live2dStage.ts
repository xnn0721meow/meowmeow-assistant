const CUBISM_CORE_SRC = '/live2d/core/live2dcubismcore.min.js'

let pluginRegistered = false
let coreLoading: Promise<void> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`无法加载 ${src}`))
    document.head.appendChild(script)
  })
}

async function ensureCubismCore(): Promise<void> {
  if ((window as unknown as { Live2DCubismCore?: unknown }).Live2DCubismCore) return
  coreLoading ??= loadScript(CUBISM_CORE_SRC).finally(() => {
    coreLoading = null
  })
  await coreLoading
  if (!(window as unknown as { Live2DCubismCore?: unknown }).Live2DCubismCore) {
    throw new Error('Cubism Core 未初始化')
  }
}

/**
 * Optional Live2D layer. The CSS mascot is always the fallback, so a missing
 * model or a missing Cubism Core never prevents the companion from running.
 */
export async function mountLive2D(host: HTMLElement, modelPath: string): Promise<() => void> {
  await ensureCubismCore()

  const [{ Application, extensions }, { Live2DModel, Live2DPlugin }] = await Promise.all([
    import('pixi.js'),
    import('untitled-pixi-live2d-engine')
  ])

  if (!pluginRegistered) {
    extensions.add(Live2DPlugin)
    pluginRegistered = true
  }

  const app = new Application()
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    preference: 'webgl',
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio)
  })

  host.appendChild(app.canvas)

  const model = await Live2DModel.from(modelPath, { autoInteract: false })
  model.anchor.set(0.5)
  app.stage.addChild(model)

  const fit = (): void => {
    const width = host.clientWidth
    const height = host.clientHeight
    if (width === 0 || height === 0) return
    const scale = Math.min(width / model.width, height / model.height)
    model.scale.set(scale)
    model.position.set(width / 2, height / 2)
  }

  fit()
  const observer = new ResizeObserver(fit)
  observer.observe(host)

  return () => {
    observer.disconnect()
    app.destroy(true)
  }
}
