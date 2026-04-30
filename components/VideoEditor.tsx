'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Volume2, VolumeX } from 'lucide-react'

interface VideoEditorProps {
  file: File
  onExport: (processedFile: File) => void
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parseTime(str: string): number {
  const parts = str.split(':').map(Number)
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0)
  return Number(str) || 0
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? '#1A56DB' : '#E5E7EB',
        position: 'relative', flexShrink: 0, cursor: 'pointer',
        transition: 'background 0.2s', display: 'inline-block',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF',
        transition: 'left 0.2s',
      }} />
    </span>
  )
}

export default function VideoEditor({ file, onExport }: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ type: 'start' | 'end' } | null>(null)
  const clipCheckRef = useRef<(() => void) | null>(null)

  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)

  const [showText, setShowText] = useState(false)
  const [overlayText, setOverlayText] = useState('')
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('bottom')
  const [textColor, setTextColor] = useState('#FFFFFF')
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium')

  const [muteAudio, setMuteAudio] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processed, setProcessed] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Load video src from file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const video = videoRef.current
    if (!video) return
    video.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => { setDuration(video.duration); setEndTime(video.duration) }
    const onTimeUpdate = () => setCurrentTime(video.currentTime)
    const onEnded = () => setPlaying(false)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
    }
  }, [])

  // Pause at endTime during preview
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const check = () => {
      if (video.currentTime >= endTime) { video.pause(); setPlaying(false) }
    }
    clipCheckRef.current = check
    video.addEventListener('timeupdate', check)
    return () => video.removeEventListener('timeupdate', check)
  }, [endTime])

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed
  }, [playbackSpeed])

  // Timeline drag via global mouse events
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragStateRef.current || !timelineRef.current || duration === 0) return
      const rect = timelineRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const t = pct * duration
      if (dragStateRef.current.type === 'start') {
        setStartTime(Math.min(t, endTime - 0.5))
      } else {
        setEndTime(Math.max(t, startTime + 0.5))
      }
    }
    function onMouseUp() { dragStateRef.current = null }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, startTime, endTime])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (playing) {
      video.pause(); setPlaying(false)
    } else {
      if (video.currentTime < startTime || video.currentTime >= endTime) video.currentTime = startTime
      video.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  function previewClip() {
    const video = videoRef.current
    if (!video) return
    video.currentTime = startTime
    video.play().then(() => setPlaying(true)).catch(() => {})
  }

  async function handleApply() {
    setProcessing(true)
    setProgress(0)
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

      const ffmpeg = new FFmpeg()
      ffmpeg.on('progress', ({ progress: p }: { progress: number }) => {
        setProgress(Math.round(p * 100))
      })

      await ffmpeg.load({
        coreURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
          'text/javascript',
        ),
        wasmURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
          'application/wasm',
        ),
      })

      await ffmpeg.writeFile('input.mp4', await fetchFile(file))

      const args: string[] = ['-i', 'input.mp4']

      if (startTime > 0 || endTime < duration) {
        args.push('-ss', startTime.toFixed(2), '-to', endTime.toFixed(2))
      }

      const vfFilters: string[] = []
      if (playbackSpeed !== 1) {
        vfFilters.push(`setpts=${(1 / playbackSpeed).toFixed(4)}*PTS`)
      }
      if (showText && overlayText.trim()) {
        const pos = textPosition === 'top' ? 'y=50' : textPosition === 'center' ? 'y=(h-text_h)/2' : 'y=h-100'
        const fontSize = textSize === 'small' ? 24 : textSize === 'medium' ? 36 : 54
        const safeText = overlayText.trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')
        vfFilters.push(`drawtext=text='${safeText}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:${pos}:shadowcolor=black:shadowx=2:shadowy=2`)
      }
      if (vfFilters.length > 0) {
        args.push('-vf', vfFilters.join(','))
      }

      if (muteAudio) {
        args.push('-an')
      } else if (playbackSpeed !== 1) {
        const aTempo = Math.min(2, Math.max(0.5, playbackSpeed))
        args.push('-filter:a', `atempo=${aTempo}`)
      }

      args.push('-c:v', 'libx264', '-preset', 'fast', 'output.mp4')

      await ffmpeg.exec(args)

      const data = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([data as BlobPart], { type: 'video/mp4' })
      const processedFile = new File([blob], 'video_editado.mp4', { type: 'video/mp4' })

      setProcessed(true)
      setToast({ msg: 'Video procesado correctamente', ok: true })
      onExport(processedFile)
    } catch (err) {
      console.error(err)
      setToast({ msg: 'Error al procesar el video', ok: false })
    } finally {
      setProcessing(false)
    }
  }

  const textTopValue = textPosition === 'top' ? '10%' : textPosition === 'center' ? '50%' : '85%'
  const textFontSize = textSize === 'small' ? 16 : textSize === 'medium' ? 24 : 36
  const clipDuration = Math.max(0, endTime - startTime)
  const disabled = processing

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      background: '#FAFAFA', border: '1px solid #E5E7EB', borderRadius: 12,
      padding: 16, marginTop: 12,
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#111827' : '#DC2626', color: '#FFFFFF',
          borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500,
          zIndex: 9999, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{toast.msg}</div>
      )}

      {/* Section A: Video preview */}
      <div>
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000', lineHeight: 0 }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            style={{ width: '100%', maxHeight: 300, borderRadius: 10, objectFit: 'contain', display: 'block' }}
          />
          {showText && overlayText && (
            <div style={{
              position: 'absolute', left: 0, right: 0,
              top: textTopValue,
              transform: textPosition === 'center' ? 'translateY(-50%)' : 'none',
              textAlign: 'center', pointerEvents: 'none', padding: '0 12px',
            }}>
              <span style={{
                fontSize: textFontSize, fontWeight: 700, color: textColor,
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}>{overlayText}</span>
            </div>
          )}
        </div>

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button onClick={togglePlay} disabled={disabled} style={{ border: 'none', background: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#374151', opacity: disabled ? 0.5 : 1 }}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace', flex: 1 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button onClick={() => setMuted((m) => !m)} disabled={disabled} style={{ border: 'none', background: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#374151', opacity: disabled ? 0.5 : 1 }}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      {/* Section B: Trim */}
      <div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Recortar</span>
        <div
          ref={timelineRef}
          style={{ width: '100%', height: 48, background: '#E5E7EB', borderRadius: 8, position: 'relative', userSelect: 'none' }}
        >
          {/* Selected range */}
          {duration > 0 && (
            <div style={{
              position: 'absolute', height: '100%',
              left: `${(startTime / duration) * 100}%`,
              width: `${((endTime - startTime) / duration) * 100}%`,
              background: 'rgba(26,86,219,0.25)', pointerEvents: 'none', borderRadius: 8,
            }} />
          )}
          {/* Playback position */}
          {duration > 0 && (
            <div style={{
              position: 'absolute', width: 2, height: '100%',
              left: `${(currentTime / duration) * 100}%`,
              background: 'rgba(26,86,219,0.6)', pointerEvents: 'none',
            }} />
          )}
          {/* Start handle */}
          {duration > 0 && (
            <div
              onMouseDown={(e) => { e.preventDefault(); dragStateRef.current = { type: 'start' } }}
              style={{
                position: 'absolute', width: 14, height: '100%',
                left: `${(startTime / duration) * 100}%`,
                background: '#1A56DB', borderRadius: 4, top: 0, cursor: 'ew-resize',
                transform: 'translateX(-7px)',
              }}
            />
          )}
          {/* End handle */}
          {duration > 0 && (
            <div
              onMouseDown={(e) => { e.preventDefault(); dragStateRef.current = { type: 'end' } }}
              style={{
                position: 'absolute', width: 14, height: '100%',
                left: `${(endTime / duration) * 100}%`,
                background: '#1A56DB', borderRadius: 4, top: 0, cursor: 'ew-resize',
                transform: 'translateX(-7px)',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={formatTime(startTime)}
            onChange={(e) => { const t = parseTime(e.target.value); if (!isNaN(t) && t >= 0 && t < endTime) setStartTime(t) }}
            style={{ width: 70, border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' }}
          />
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>—</span>
          <input
            type="text"
            value={formatTime(endTime)}
            onChange={(e) => { const t = parseTime(e.target.value); if (!isNaN(t) && t > startTime && t <= duration) setEndTime(t) }}
            style={{ width: 70, border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' }}
          />
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
            Duracion del clip: {clipDuration.toFixed(1)} segundos
          </span>
        </div>
      </div>

      {/* Section C: Text overlay */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: showText ? 12 : 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Texto sobre el video</span>
          <Toggle value={showText} onChange={setShowText} />
        </div>
        {showText && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              placeholder="Ej: Restaurante Kebab · Oferta 2x1"
              style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={textPosition}
                onChange={(e) => setTextPosition(e.target.value as 'top' | 'center' | 'bottom')}
                style={{ width: 100, border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: '#374151', background: '#FFFFFF' }}
              >
                <option value="top">Arriba</option>
                <option value="center">Centro</option>
                <option value="bottom">Abajo</option>
              </select>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                title="Color del texto"
                style={{ width: 28, height: 28, border: '1px solid #E5E7EB', borderRadius: 4, cursor: 'pointer', padding: 2, background: 'none' }}
              />
              <select
                value={textSize}
                onChange={(e) => setTextSize(e.target.value as 'small' | 'medium' | 'large')}
                style={{ width: 100, border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: '#374151', background: '#FFFFFF' }}
              >
                <option value="small">Pequeno</option>
                <option value="medium">Mediano</option>
                <option value="large">Grande</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Section D: Additional options */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#374151' }}>Silenciar audio</span>
          <Toggle value={muteAudio} onChange={setMuteAudio} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#374151' }}>Velocidad</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {([1, 1.5, 2] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => { setPlaybackSpeed(speed) }}
                style={{
                  padding: '3px 10px', borderRadius: 999,
                  border: `1px solid ${playbackSpeed === speed ? '#1A56DB' : '#E5E7EB'}`,
                  background: playbackSpeed === speed ? '#EEF3FE' : '#FFFFFF',
                  color: playbackSpeed === speed ? '#1A56DB' : '#374151',
                  fontSize: 12, fontWeight: playbackSpeed === speed ? 600 : 400, cursor: 'pointer',
                }}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Processing progress */}
      {processing && (
        <div>
          <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#1A56DB', borderRadius: 3,
              width: progress > 0 ? `${progress}%` : '30%',
              transition: progress > 0 ? 'width 0.3s ease' : 'none',
              animation: progress === 0 ? 'vid-indeterminate 1.4s ease-in-out infinite' : 'none',
            }} />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
            Procesando video...{progress > 0 ? ` ${progress}%` : ''}
          </p>
        </div>
      )}

      {/* Processed badge */}
      {processed && !processing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 500 }}>Video editado listo para publicar</span>
        </div>
      )}

      {/* Section E: Action buttons */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        {processed ? (
          <button
            onClick={() => setProcessed(false)}
            style={{ padding: '9px 18px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Volver a editar
          </button>
        ) : (
          <>
            <button
              onClick={previewClip}
              disabled={disabled}
              style={{ padding: '9px 18px', border: '1px solid #E5E7EB', borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
            >
              Previsualizar clip
            </button>
            <button
              onClick={handleApply}
              disabled={disabled}
              style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: disabled ? '#9CA3AF' : '#1A56DB', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', minWidth: 140 }}
            >
              {processing ? `Procesando... ${progress > 0 ? `${progress}%` : ''}` : 'Aplicar cambios'}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes vid-indeterminate {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
