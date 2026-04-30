'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fixEncoding, fixEncodingDeep } from '@/lib/fix-encoding'
import { Sparkles, Lightbulb, PenLine, Target, TrendingUp, Mic, ImageIcon } from 'lucide-react'

const C = {
  bg:        '#F7F8FA',
  surface:   '#FFFFFF',
  border:    '#E5E7EB',
  borderStr: '#D1D5DB',
  primary:   '#1A56DB',
  primaryHv: '#1648C0',
  primaryLt: '#EEF3FE',
  t1:        '#111827',
  t2:        '#374151',
  t3:        '#4B5563',
  t4:        '#9CA3AF',
  success:   '#0E9F6E',
  error:     '#E02424',
}

interface ChatAttachment {
  id: string
  kind: 'image' | 'audio'
  name: string
  type: string
  url: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: ChatAttachment[]
  isError?: boolean
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

const SUGGESTIONS = [
  { text: 'Dame ideas de contenido para esta semana', Icon: Lightbulb },
  { text: 'Como mejorar mi presencia en Instagram', Icon: TrendingUp },
  { text: 'Genera un post para promocionar mi negocio hoy', Icon: PenLine },
  { text: 'Que estrategia me recomiendas para mas clientes', Icon: Target },
]

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/)
  return parts.map((part, i) => {
    if (part === '\n') return <br key={i} />
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    return part
  })
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - ts) / 86400000)
  if (diff === 0) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Ayer'
  return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' })
}

function buildConversation(title = 'Nueva conversacion'): Conversation {
  const now = Date.now()
  return { id: `${now}_${Math.random().toString(36).slice(2, 8)}`, title, messages: [], createdAt: now }
}

function getTitleFromMessage(msg: string) {
  const cleaned = fixEncoding(msg).trim()
  return cleaned ? cleaned.slice(0, 30) : 'Nueva conversacion'
}

function AIAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #1A56DB 0%, #3B82F6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: size > 32 ? '0 4px 16px rgba(26,86,219,0.25)' : '0 1px 4px rgba(26,86,219,0.3)',
      }}
    >
      <Sparkles size={Math.round(size * 0.43)} color="white" />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }} className="msg-appear">
      <AIAvatar size={28} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '12px 16px',
          borderRadius: '4px 16px 16px 16px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: C.t3,
              display: 'inline-block',
              animation: 'blink 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function SuggestionCard({
  text,
  Icon,
  onSelect,
}: {
  text: string
  Icon: React.ElementType
  onSelect: (t: string) => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => onSelect(text)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '13px 14px',
        borderRadius: 12,
        border: `1px solid ${hov ? C.primary : C.border}`,
        background: hov ? C.primaryLt : C.surface,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        width: '100%',
      }}
    >
      <Icon size={18} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>{text}</span>
    </button>
  )
}

function ActionBtn({
  onClick,
  disabled,
  label,
  active,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  active?: boolean
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: 'none',
        background: active ? '#FEF2F2' : hov ? '#F3F4F6' : 'transparent',
        color: active ? C.error : hov ? C.t2 : C.t4,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 120ms',
      }}
    >
      {children}
    </button>
  )
}

interface ChatInputProps {
  inputValue: string
  isLoading: boolean
  canSend: boolean
  isRecording: boolean
  recordingError: string | null
  imagePreviewUrl: string | null
  imageName: string | null
  audioPreviewUrl: string | null
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onOpenCamera: () => void
  onStartRecording: () => void
  onStopRecording: () => void
  onRemoveImage: () => void
  onRemoveAudio: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  imageInputRef: React.RefObject<HTMLInputElement | null>
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function ChatInput({
  inputValue,
  isLoading,
  canSend,
  isRecording,
  recordingError,
  imagePreviewUrl,
  imageName,
  audioPreviewUrl,
  onInputChange,
  onKeyDown,
  onSend,
  onOpenCamera,
  onStartRecording,
  onStopRecording,
  onRemoveImage,
  onRemoveAudio,
  textareaRef,
  imageInputRef,
  onImageChange,
}: ChatInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ width: '100%' }}>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />

      {(imagePreviewUrl || audioPreviewUrl || recordingError) && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {imagePreviewUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.surface,
                padding: '6px 8px',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt={imageName ?? 'preview'} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} />
              <span style={{ fontSize: 12, color: C.t2, maxWidth: 160, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {imageName ?? 'Imagen'}
              </span>
              <button onClick={onRemoveImage} style={{ fontSize: 11, color: C.t3, background: 'none', border: 'none', cursor: 'pointer' }}>
                Quitar
              </button>
            </div>
          )}
          {audioPreviewUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.surface,
                padding: '6px 8px',
              }}
            >
              <audio controls src={audioPreviewUrl} style={{ height: 32, width: 208 }} />
              <button onClick={onRemoveAudio} style={{ fontSize: 11, color: C.t3, background: 'none', border: 'none', cursor: 'pointer' }}>
                Quitar
              </button>
            </div>
          )}
          {recordingError && (
            <div
              style={{
                borderRadius: 8,
                border: '1px solid #FECACA',
                background: '#FEF2F2',
                padding: '4px 10px',
                fontSize: 12,
                color: C.error,
              }}
            >
              {recordingError}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          background: C.surface,
          border: `1.5px solid ${focused ? C.primary : C.borderStr}`,
          borderRadius: 14,
          padding: '10px 12px',
          boxShadow: focused
            ? '0 0 0 3px rgba(26,86,219,0.10), 0 2px 8px rgba(0,0,0,0.06)'
            : '0 2px 8px rgba(0,0,0,0.06)',
          transition: 'border-color 150ms, box-shadow 150ms',
        }}
      >
        <ActionBtn onClick={onOpenCamera} disabled={isLoading} label="Subir imagen">
          <ImageIcon size={17} />
        </ActionBtn>

        <ActionBtn
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isLoading}
          label={isRecording ? 'Detener grabacion' : 'Iniciar grabacion'}
          active={isRecording}
        >
          {isRecording ? (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: C.error,
                display: 'inline-block',
                animation: 'pulse 1s ease-in-out infinite',
              }}
            />
          ) : (
            <Mic size={17} />
          )}
        </ActionBtn>

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={isRecording ? 'Grabando audio...' : 'Escribe tu mensaje...'}
          rows={1}
          disabled={isLoading}
          style={{
            flex: 1,
            resize: 'none',
            background: 'transparent',
            outline: 'none',
            border: 'none',
            fontSize: 14,
            color: C.t1,
            lineHeight: 1.55,
            padding: '5px 10px',
            maxHeight: 120,
            minHeight: 26,
            overflowY: 'auto',
            fontFamily: 'inherit',
          }}
        />

        <button
          onClick={onSend}
          disabled={!canSend}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: canSend ? C.primary : '#F3F4F6',
            color: canSend ? '#FFFFFF' : C.t4,
            cursor: canSend ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: canSend ? '0 2px 6px rgba(26,86,219,0.3)' : 'none',
            transition: 'all 120ms',
          }}
          aria-label="Enviar mensaje"
        >
          {isLoading ? (
            <span
              style={{
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.6s linear infinite',
              }}
            />
          ) : (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M7.5 12.5V2.5M7.5 2.5L3 7M7.5 2.5L12 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <p style={{ fontSize: 11, color: C.t4, textAlign: 'center', marginTop: 8 }}>
        Enter para enviar · Shift+Enter para nueva linea
      </p>
    </div>
  )
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [businessPlan, setBusinessPlan] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const activeChat = useMemo(
    () => conversations.find((c) => c.id === activeChatId) ?? null,
    [conversations, activeChatId]
  )
  const messages = useMemo(() => activeChat?.messages ?? [], [activeChat])
  const hasMessages = messages.length > 0

  useEffect(() => {
    async function fetchBusiness() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: business } = await supabase
        .from('businesses')
        .select('id, name, plan')
        .eq('owner_id', user.id)
        .single()
      if (business) {
        setBusinessId(business.id)
        setBusinessName(business.name || '')
        setBusinessPlan(business.plan || '')
      }
    }
    fetchBusiness()
  }, [])

  useEffect(() => {
    if (!businessId) return
    const convKey = `chat_conversations_${businessId}`
    const activeKey = `chat_active_${businessId}`
    try {
      const stored = localStorage.getItem(convKey)
      const storedActive = localStorage.getItem(activeKey)
      if (stored) {
        const parsed = fixEncodingDeep(JSON.parse(stored) as Conversation[])
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed)
          const valid = storedActive && parsed.some((c) => c.id === storedActive)
          setActiveChatId(valid ? storedActive : parsed[0].id)
          return
        }
      }
    } catch { /* ignore */ }
    const first = buildConversation()
    setConversations([first])
    setActiveChatId(first.id)
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    try { localStorage.setItem(`chat_conversations_${businessId}`, JSON.stringify(conversations)) } catch { /* ignore */ }
  }, [conversations, businessId])

  useEffect(() => {
    if (!businessId || !activeChatId) return
    try { localStorage.setItem(`chat_active_${businessId}`, activeChatId) } catch { /* ignore */ }
  }, [activeChatId, businessId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [imagePreviewUrl, audioPreviewUrl])

  function createNewChat() {
    const c = buildConversation()
    setConversations((prev) => [c, ...prev])
    setActiveChatId(c.id)
    setInputValue('')
    setRecordingError(null)
    clearImage()
    clearAudio()
  }

  function clearImage() {
    setImageFile(null)
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function clearAudio() {
    setAudioBlob(null)
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
    setAudioPreviewUrl(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  async function startRecording() {
    try {
      setRecordingError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      audioChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
        setAudioPreviewUrl(URL.createObjectURL(blob))
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
        setIsRecording(false)
      }
      recorder.start()
      setIsRecording(true)
    } catch {
      setRecordingError('No se pudo acceder al microfono.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if ((!trimmed && !imageFile && !audioBlob) || isLoading || !businessId) return

    let chatId = activeChatId
    if (!chatId) {
      const nc = buildConversation()
      setConversations((prev) => [nc, ...prev])
      setActiveChatId(nc.id)
      chatId = nc.id
    }

    const snapshot = conversations.find((c) => c.id === chatId) ?? {
      id: chatId!, title: 'Nueva conversacion', messages: [], createdAt: Date.now(),
    }

    const userAttachments: ChatAttachment[] = []
    if (imageFile) userAttachments.push({ id: `img_${Date.now()}`, kind: 'image', name: imageFile.name, type: imageFile.type, url: URL.createObjectURL(imageFile) })
    if (audioBlob) userAttachments.push({ id: `aud_${Date.now()}`, kind: 'audio', name: `audio-${Date.now()}.webm`, type: audioBlob.type || 'audio/webm', url: URL.createObjectURL(audioBlob) })

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: fixEncoding(trimmed || 'Mensaje multimodal'),
      attachments: userAttachments.length > 0 ? userAttachments : undefined,
    }
    const asstId = `assistant_${Date.now() + 1}`
    const asstMsg: Message = { id: asstId, role: 'assistant', content: '' }
    const apiMessages = [...snapshot.messages, userMsg].slice(-30).map(({ role, content }) => ({ role, content }))
    const isFirst = snapshot.messages.length === 0 && snapshot.title === 'Nueva conversacion'
    const nextTitle = isFirst ? getTitleFromMessage(trimmed || 'Mensaje multimodal') : snapshot.title

    setConversations((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, title: nextTitle, messages: [...c.messages, userMsg, asstMsg] }
          : c
      )
    )
    setInputValue('')
    clearImage()
    clearAudio()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)

    try {
      const fd = new FormData()
      fd.append('business_id', businessId)
      fd.append('messages', JSON.stringify(apiMessages))
      fd.append('text', userMsg.content)
      if (imageFile) fd.append('image', imageFile)
      if (audioBlob) fd.append('audio', new File([audioBlob], `audio-${Date.now()}.webm`, { type: audioBlob.type || 'audio/webm' }))

      const res = await fetch('/api/chat', { method: 'POST', body: fd })
      if (!res.ok || !res.body) throw new Error('Error en la respuesta')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setConversations((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? { ...c, messages: c.messages.map((m) => m.id === asstId ? { ...m, content: acc } : m) }
              : c
          )
        )
      }
    } catch {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === asstId
                    ? { ...m, content: 'Ocurrio un error al generar la respuesta. Intenta de nuevo.', isError: true }
                    : m
                ),
              }
            : c
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const canSend = (inputValue.trim().length > 0 || !!imageFile || !!audioBlob) && !isLoading && !!businessId
  const businessInitials = businessName.slice(0, 2).toUpperCase() || 'IA'

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: C.bg }}>

      {/* ── Conversation sidebar (collapsible) ── */}
      <div style={{ width: sidebarOpen ? 256 : 0, transition: 'width 200ms ease', overflow: 'hidden', flexShrink: 0 }}>
        <aside
          style={{
            width: 256,
            height: '100%',
            background: C.surface,
            borderRight: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Sidebar header */}
          <div style={{ padding: '16px 14px 12px', borderBottom: `1px solid ${C.border}` }}>
            <NewConvButton onClick={createNewChat} />
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: C.t4,
                padding: '6px 8px 8px',
              }}
            >
              RECIENTES
            </p>
            {conversations.map((chat) => {
              const isActive = chat.id === activeChatId
              const lastMsg = chat.messages[chat.messages.length - 1]
              return (
                <ConvItem
                  key={chat.id}
                  chat={chat}
                  isActive={isActive}
                  lastMsg={lastMsg}
                  onClick={() => setActiveChatId(chat.id)}
                />
              )
            })}
          </div>

          {/* Sidebar footer */}
          <div
            style={{
              padding: '12px 14px',
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: C.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {businessInitials}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.t1,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {businessName || 'Mi negocio'}
              </p>
              <p style={{ fontSize: 11, color: C.t4 }}>{businessPlan || 'Plan gratuito'}</p>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Main chat area ── */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Chat header */}
        <div
          style={{
            height: 56,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Hamburger */}
            <HamburgerBtn onClick={() => setSidebarOpen((o) => !o)} />

            {/* Assistant info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.t1, letterSpacing: '-0.2px' }}>
                  Asistente IA
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 500,
                    color: C.success,
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    padding: '2px 8px',
                    borderRadius: 100,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
                  Online
                </span>
              </div>
              <p style={{ fontSize: 11, color: C.t4, marginTop: 1 }}>Texto, imagen y voz en un solo chat</p>
            </div>
          </div>

          {/* Nueva conversacion */}
          <HeaderNewBtn onClick={createNewChat} />
        </div>

        {/* Empty state */}
        {!hasMessages && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 24px',
              gap: 28,
              overflowY: 'auto',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <AIAvatar size={64} />
              </div>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.t1, letterSpacing: '-0.3px', marginBottom: 6 }}>
                En que puedo ayudarte hoy?
              </p>
              <p style={{ fontSize: 13, color: C.t3, lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
                Soy tu asistente de marketing. Puedo crear contenido, disenar estrategias y responder cualquier duda.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                width: '100%',
                maxWidth: 520,
              }}
            >
              {SUGGESTIONS.map(({ text, Icon }) => (
                <SuggestionCard key={text} text={text} Icon={Icon} onSelect={sendMessage} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['Texto', 'Imagen', 'Voz'].map((cap) => (
                <span
                  key={cap}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '4px 12px',
                    borderRadius: 100,
                    border: `1px solid ${C.border}`,
                    background: C.surface,
                    color: C.t3,
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {hasMessages && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {messages.map((msg) => (
              <div key={msg.id} className="msg-appear">
                {msg.attachments && msg.attachments.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 8,
                      maxWidth: '72%',
                      marginLeft: msg.role === 'user' ? 'auto' : 0,
                    }}
                  >
                    {msg.attachments.map((att) =>
                      att.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={att.id}
                          src={att.url}
                          alt={att.name}
                          style={{ height: 112, width: 160, borderRadius: 10, border: `1px solid ${C.border}`, objectFit: 'cover' }}
                        />
                      ) : (
                        <audio
                          key={att.id}
                          controls
                          src={att.url}
                          style={{ height: 40, width: 224, borderRadius: 10, border: `1px solid ${C.border}` }}
                        />
                      )
                    )}
                  </div>
                )}

                {msg.role === 'user' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        maxWidth: '72%',
                        padding: '10px 16px',
                        borderRadius: '16px 4px 16px 16px',
                        background: C.primary,
                        color: '#FFFFFF',
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {fixEncoding(msg.content)}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <AIAvatar size={28} />
                    <div
                      style={{
                        maxWidth: '72%',
                        padding: '12px 16px',
                        borderRadius: '4px 16px 16px 16px',
                        background: msg.isError ? '#FEF2F2' : C.surface,
                        border: `1px solid ${msg.isError ? '#FECACA' : C.border}`,
                        color: msg.isError ? C.error : C.t1,
                        fontSize: 13,
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      {renderMarkdown(fixEncoding(msg.content))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input — always at the bottom */}
        <div
          style={{
            padding: '12px 20px 16px',
            background: hasMessages ? C.bg : C.surface,
            borderTop: `1px solid ${C.border}`,
            flexShrink: 0,
          }}
        >
          <ChatInput
            inputValue={inputValue}
            isLoading={isLoading}
            canSend={canSend}
            isRecording={isRecording}
            recordingError={recordingError}
            imagePreviewUrl={imagePreviewUrl}
            imageName={imageFile?.name ?? null}
            audioPreviewUrl={audioPreviewUrl}
            onInputChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onSend={() => sendMessage(inputValue)}
            onOpenCamera={() => imageInputRef.current?.click()}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onRemoveImage={clearImage}
            onRemoveAudio={clearAudio}
            textareaRef={textareaRef}
            imageInputRef={imageInputRef}
            onImageChange={handleImageUpload}
          />
        </div>
      </section>
    </div>
  )
}

/* ── Small UI sub-components ── */

function NewConvButton({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: '9px 14px',
        borderRadius: 9,
        border: `1px solid ${C.border}`,
        background: hov ? C.primaryLt : '#F9FAFB',
        color: C.t1,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 120ms',
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 300, lineHeight: 1 }}>+</span>
      Nueva conversacion
    </button>
  )
}

function ConvItem({
  chat,
  isActive,
  lastMsg,
  onClick,
}: {
  chat: Conversation
  isActive: boolean
  lastMsg: Message | undefined
  onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '9px 10px',
        borderRadius: 9,
        border: `1px solid ${isActive ? '#BFDBFE' : 'transparent'}`,
        background: isActive ? C.primaryLt : hov ? '#F9FAFB' : 'transparent',
        cursor: 'pointer',
        transition: 'all 120ms',
        marginBottom: 2,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: isActive ? C.primary : C.t1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          {fixEncoding(chat.title)}
        </span>
        <span style={{ fontSize: 10, color: C.t4, flexShrink: 0 }}>{formatTime(chat.createdAt)}</span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: isActive ? '#3B82F6' : C.t4,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {lastMsg ? fixEncoding(lastMsg.content).slice(0, 40) || '...' : 'Sin mensajes'}
      </div>
    </button>
  )
}

function HamburgerBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: 6,
        borderRadius: 7,
        border: 'none',
        background: hov ? '#F3F4F6' : 'transparent',
        color: hov ? C.t1 : C.t4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 120ms',
        flexShrink: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3.5" width="12" height="1.5" rx="0.75" fill="currentColor" />
        <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor" />
        <rect x="2" y="11" width="12" height="1.5" rx="0.75" fill="currentColor" />
      </svg>
    </button>
  )
}

function HeaderNewBtn({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 8,
        border: `1px solid ${hov ? '#BFDBFE' : C.border}`,
        background: hov ? C.primaryLt : '#F9FAFB',
        color: hov ? C.primary : C.t2,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 120ms',
        flexShrink: 0,
      }}
    >
      + Nueva conversacion
    </button>
  )
}
