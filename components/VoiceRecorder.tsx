'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/Button'

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  maxDurationSeconds?: number
}

type RecorderState = 'idle' | 'recording' | 'recorded'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function getPreferredMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return 'audio/ogg'
}

export function VoiceRecorder({
  onRecordingComplete,
  maxDurationSeconds = 120,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  // Draw waveform on canvas while recording
  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      ctx.fillStyle = '#F7F8FA'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = '#EF4444'
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    draw()
  }, [])

  async function startRecording() {
    setError(null)
    setElapsed(0)
    chunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('No se pudo acceder al microfono. Comprueba los permisos del navegador.')
      return
    }

    streamRef.current = stream

    // Set up Web Audio API analyser
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    analyserRef.current = analyser

    const mimeType = getPreferredMimeType()
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setAudioBlob(blob)
      setAudioDuration(elapsed)

      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = URL.createObjectURL(blob)

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      stream.getTracks().forEach(t => t.stop())
      setState('recorded')
    }

    recorder.start(100)
    setState('recording')
    drawWaveform()

    // Timer
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next >= maxDurationSeconds) {
          stopRecording()
        }
        return next
      })
    }, 1000)
  }

  function stopRecording() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  function resetRecorder() {
    setAudioBlob(null)
    setUploadedFile(null)
    setElapsed(0)
    setAudioDuration(0)
    setError(null)
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setState('idle')
  }

  function handleUseRecording() {
    if (audioBlob) {
      onRecordingComplete(audioBlob)
    }
  }

  function handleUseFile() {
    if (uploadedFile) {
      onRecordingComplete(uploadedFile)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setAudioBlob(null)
    setState('recorded')
  }

  const progressPct = Math.min((elapsed / maxDurationSeconds) * 100, 100)

  // ── IDLE ──
  if (state === 'idle') {
    return (
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-sm text-[#EF4444]">{error}</p>
        )}
        <div className="rounded-lg bg-[#F7F8FA] border border-[#E5E7EB] p-4 flex flex-col gap-1">
          <p className="text-sm text-[#111827] font-medium">
            Graba al menos 30 segundos de tu voz hablando con naturalidad
          </p>
          <p className="text-xs text-[#374151]">
            Lee un texto en voz alta, cuenta algo sobre tu negocio, o simplemente habla
          </p>
        </div>

        <Button onClick={startRecording}>
          Iniciar grabacion
        </Button>

        <div className="text-center">
          <button
            type="button"
            className="text-sm text-[#2563EB] underline underline-offset-2 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            O sube un archivo de audio
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,.webm,audio/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    )
  }

  // ── RECORDING ──
  if (state === 'recording') {
    return (
      <div className="flex flex-col gap-4">
        {/* Pulsing indicator */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF4444]" />
          </span>
          <span className="text-sm font-medium text-[#EF4444]">Grabando...</span>
          <span className="ml-auto text-sm font-mono text-[#374151]">
            {formatTime(elapsed)} / {formatTime(maxDurationSeconds)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#EF4444] rounded-full transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Waveform canvas */}
        <canvas
          ref={canvasRef}
          width={300}
          height={60}
          className="w-full rounded-lg border border-[#E5E7EB] bg-[#F7F8FA]"
        />

        <Button variant="secondary" onClick={stopRecording}>
          Detener grabacion
        </Button>
      </div>
    )
  }

  // ── RECORDED ──
  if (uploadedFile) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] p-3">
          <p className="text-sm text-[#166534] font-medium">{uploadedFile.name}</p>
          <p className="text-xs text-[#166534] mt-0.5">
            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleUseFile}>Usar este archivo</Button>
          <Button variant="secondary" onClick={resetRecorder}>Volver a empezar</Button>
        </div>
      </div>
    )
  }

  // Recorded from mic
  return (
    <div className="flex flex-col gap-4">
      {audioUrlRef.current && (
        <audio controls src={audioUrlRef.current} className="w-full" />
      )}
      <p className="text-xs text-[#374151]">
        Duracion grabada: {formatTime(audioDuration)}
      </p>
      <div className="flex gap-3">
        <Button onClick={handleUseRecording}>Usar esta grabacion</Button>
        <Button variant="secondary" onClick={resetRecorder}>Volver a grabar</Button>
      </div>
    </div>
  )
}

