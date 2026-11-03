import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { VisionSignal, VisionStatus } from '@shared/focus/types'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const DETECT_INTERVAL_MS = 220

interface FaceTrackerOptions {
  onSignal: (signal: VisionSignal) => void
  onStatus: (status: VisionStatus, message?: string) => void
}

function headRotation(data: number[] | undefined): { yaw: number; pitch: number } {
  if (!data || data.length < 16) return { yaw: 0, pitch: 0 }
  const rad2deg = 180 / Math.PI
  const yaw = Math.atan2(data[8], data[10]) * rad2deg
  const pitch = Math.asin(Math.max(-1, Math.min(1, -data[9]))) * rad2deg
  return { yaw, pitch }
}

function lookingFromLandmarks(landmarks: { x: number; y: number }[]): boolean {
  if (landmarks.length < 264) return true
  const nose = landmarks[1]
  const rightEye = landmarks[33]
  const leftEye = landmarks[263]
  if (!nose || !rightEye || !leftEye) return true
  const eyeDistance = Math.abs(leftEye.x - rightEye.x)
  if (eyeDistance < 1e-6) return true
  const noseOffset = (nose.x - (rightEye.x + leftEye.x) / 2) / eyeDistance
  return Math.abs(noseOffset) < 0.22
}

/**
 * Local-only webcam reader. Frames are consumed in memory and immediately
 * reduced to a handful of numbers; nothing is recorded or uploaded.
 */
export class FaceTracker {
  private landmarker: FaceLandmarker | null = null
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private timer: number | null = null
  private running = false
  private starting: Promise<void> | null = null
  private generation = 0
  private lastTimestamp = 0

  constructor(private readonly options: FaceTrackerOptions) {}

  start(): Promise<void> {
    if (this.running) return Promise.resolve()
    if (this.starting) return this.starting

    const generation = ++this.generation
    this.starting = this.startInternal(generation).finally(() => {
      this.starting = null
    })
    return this.starting
  }

  stop(): void {
    this.generation += 1
    this.running = false
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }

    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null

    if (this.video) {
      this.video.pause()
      this.video.srcObject = null
      this.video.remove()
      this.video = null
    }

    this.landmarker?.close()
    this.landmarker = null
    this.options.onStatus('idle')
  }

  private async startInternal(generation: number): Promise<void> {
    this.options.onStatus('starting', '正在加载本地视觉模型')

    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL)
      if (generation !== this.generation) return

      const baseOptions = {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU' as 'GPU' | 'CPU'
      }

      try {
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions,
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true
        })
      } catch (gpuError) {
        console.warn('GPU delegate failed, retrying with CPU:', gpuError)
        baseOptions.delegate = 'CPU'
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions,
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true
        })
      }
      if (generation !== this.generation) {
        this.landmarker?.close()
        this.landmarker = null
        return
      }

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 5, max: 10 },
          facingMode: 'user'
        }
      })
      if (generation !== this.generation) {
        this.stream.getTracks().forEach((track) => track.stop())
        this.stream = null
        return
      }

      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      video.style.cssText =
        'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;'
      video.srcObject = this.stream
      document.body.appendChild(video)
      this.video = video

      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 1) {
          resolve()
          return
        }
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('视频流初始化失败'))
      })
      await video.play()

      if (generation !== this.generation) {
        this.stream?.getTracks().forEach((track) => track.stop())
        this.stream = null
        video.pause()
        video.srcObject = null
        video.remove()
        this.video = null
        return
      }

      this.running = true
      this.options.onStatus('active')
      this.loop()
    } catch (error) {
      if (generation !== this.generation) return

      this.running = false
      this.stream?.getTracks().forEach((track) => track.stop())
      this.stream = null
      this.video?.pause()
      if (this.video) this.video.srcObject = null
      this.video?.remove()
      this.video = null
      this.landmarker?.close()
      this.landmarker = null

      const name = error instanceof Error ? error.name : 'UnknownError'
      const message =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? '摄像头权限被拒绝，请在系统隐私设置中允许后重启应用。当前只用窗口信号。'
          : '视觉模型或摄像头初始化失败，可能处于离线状态。当前只用窗口信号。'

      console.warn('Face tracker unavailable:', error)
      this.options.onStatus(name === 'NotAllowedError' ? 'unavailable' : 'error', message)
      throw new Error(message)
    }
  }

  private loop = (): void => {
    if (!this.running) return

    this.timer = window.setTimeout(this.loop, DETECT_INTERVAL_MS)

    const video = this.video
    const landmarker = this.landmarker
    if (!video || !landmarker || video.readyState < 2 || video.videoWidth === 0) return

    const timestamp = performance.now()
    if (timestamp <= this.lastTimestamp) return
    this.lastTimestamp = timestamp

    try {
      const result = landmarker.detectForVideo(video, timestamp)
      const landmarks = result.faceLandmarks[0]
      const facePresent = Boolean(landmarks && landmarks.length > 0)
      const matrix = result.facialTransformationMatrixes?.[0]?.data
      const rotation = headRotation(matrix as number[] | undefined)
      const categories = result.faceBlendshapes?.[0]?.categories ?? []
      const blinkLeft = categories.find((item) => item.categoryName === 'eyeBlinkLeft')?.score ?? 0
      const blinkRight = categories.find((item) => item.categoryName === 'eyeBlinkRight')?.score ?? 0

      const signal: VisionSignal = {
        facePresent,
        lookingAtScreen: facePresent ? lookingFromLandmarks(landmarks) : false,
        eyesOpen: facePresent ? (blinkLeft + blinkRight) / 2 < 0.5 : false,
        yaw: rotation.yaw,
        pitch: rotation.pitch,
        confidence: facePresent ? 1 : 0,
        timestamp: Date.now()
      }

      this.options.onSignal(signal)
    } catch (error) {
      console.warn('Face detection frame failed:', error)
    }
  }
}
