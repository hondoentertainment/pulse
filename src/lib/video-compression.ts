export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeMB?: number
  videoBitrate?: number
  audioBitrate?: number
}

export interface CompressionProgress {
  percent: number
  currentTime: number
  totalDuration: number
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1280,
  maxHeight: 720,
  quality: 0.8,
  maxSizeMB: 10,
  videoBitrate: 1500000,
  audioBitrate: 128000
}

export async function compressVideo(
  file: File,
  options: CompressionOptions = {},
  onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const videoElement = document.createElement('video')
  videoElement.preload = 'metadata'
  videoElement.muted = true

  const loadVideo = new Promise<HTMLVideoElement>((resolve, reject) => {
    videoElement.onloadedmetadata = () => {
      resolve(videoElement)
    }
    videoElement.onerror = () => {
      reject(new Error('Failed to load video'))
    }
    videoElement.src = URL.createObjectURL(file)
  })

  const video = await loadVideo

  const originalWidth = video.videoWidth
  const originalHeight = video.videoHeight
  const duration = video.duration

  let targetWidth = originalWidth
  let targetHeight = originalHeight

  if (originalWidth > opts.maxWidth || originalHeight > opts.maxHeight) {
    const aspectRatio = originalWidth / originalHeight
    if (aspectRatio > 1) {
      targetWidth = opts.maxWidth
      targetHeight = Math.round(opts.maxWidth / aspectRatio)
    } else {
      targetHeight = opts.maxHeight
      targetWidth = Math.round(opts.maxHeight * aspectRatio)
    }
  }

  targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1
  targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    URL.revokeObjectURL(video.src)
    throw new Error('Failed to get canvas context')
  }

  const mediaRecorder = await createMediaRecorder(video, canvas, ctx, opts, duration, onProgress)
  
  const chunks: Blob[] = []
  
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  const recordingComplete = new Promise<Blob>((resolve, reject) => {
    mediaRecorder.onstop = () => {
      URL.revokeObjectURL(video.src)
      const blob = new Blob(chunks, { type: 'video/webm' })
      resolve(blob)
    }
    
    mediaRecorder.onerror = (e) => {
      URL.revokeObjectURL(video.src)
      reject(e)
    }
  })

  mediaRecorder.start(100)
  video.play()

  return recordingComplete
}

async function createMediaRecorder(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: Required<CompressionOptions>,
  duration: number,
  onProgress?: (progress: CompressionProgress) => void
): Promise<MediaRecorder> {
  const stream = canvas.captureStream(30)

  const audioContext = new AudioContext()
  const sourceNode = audioContext.createMediaElementSource(video)
  const destNode = audioContext.createMediaStreamDestination()
  sourceNode.connect(destNode)
  sourceNode.connect(audioContext.destination)

  const audioTracks = destNode.stream.getAudioTracks()
  audioTracks.forEach((track) => stream.addTrack(track))

  const mimeType = getSupportedMimeType()
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: opts.videoBitrate,
    audioBitsPerSecond: opts.audioBitrate
  })

  let lastProgressUpdate = 0
  const progressInterval = 100

  const renderFrame = () => {
    if (video.paused || video.ended) {
      mediaRecorder.stop()
      stream.getTracks().forEach((track) => track.stop())
      audioContext.close()
      return
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const now = Date.now()
    if (onProgress && now - lastProgressUpdate > progressInterval) {
      lastProgressUpdate = now
      onProgress({
        percent: Math.min((video.currentTime / duration) * 100, 100),
        currentTime: video.currentTime,
        totalDuration: duration
      })
    }

    requestAnimationFrame(renderFrame)
  }

  video.addEventListener('play', () => {
    renderFrame()
  })

  return mediaRecorder
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4'
  ]

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }

  return 'video/webm'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round(((originalSize - compressedSize) / originalSize) * 100)
}
