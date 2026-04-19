'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fixEncoding, fixEncodingDeep } from '@/lib/fix-encoding'

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
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

const QUICK_SUGGESTIONS = [
  'Dame ideas de contenido para esta semana',
  'Como puedo mejorar mi presencia en Instagram',
  'Genera un post para promocionar mi negocio hoy',
  'Que estrategia me recomiendas para conseguir mas clientes',
]

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/)
  return parts.map((part, i) => {
    if (part === '\n') return <br key={i} />
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-[4px_16px_16px_16px] border border-[#E5E7EB] bg-white px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4B5563]"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function buildConversation(title = 'Nueva conversación'): Conversation {
  const now = Date.now()
  return {
    id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    messages: [],
    createdAt: now,
  }
}

function getTitleFromMessage(message: string) {
  const cleaned = fixEncoding(message).trim()
  if (!cleaned) return 'Nueva conversación'
  return cleaned.slice(0, 30)
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)

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
    () => conversations.find((chat) => chat.id === activeChatId) ?? null,
    [conversations, activeChatId]
  )
  const messages = useMemo(() => activeChat?.messages ?? [], [activeChat])
  const hasMessages = messages.length > 0

  useEffect(() => {
    async function fetchBusiness() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single()
      if (business) setBusinessId(business.id)
    }
    fetchBusiness()
  }, [])

  useEffect(() => {
    if (!businessId) return

    const conversationsKey = `chat_conversations_${businessId}`
    const activeKey = `chat_active_${businessId}`

    try {
      const storedConversations = localStorage.getItem(conversationsKey)
      const storedActive = localStorage.getItem(activeKey)

      if (storedConversations) {
        const parsed = fixEncodingDeep(JSON.parse(storedConversations) as Conversation[])
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed)
          const hasStoredActive = storedActive && parsed.some((chat) => chat.id === storedActive)
          setActiveChatId(hasStoredActive ? storedActive : parsed[0].id)
          return
        }
      }
    } catch {
      // ignore
    }

    const firstChat = buildConversation()
    setConversations([firstChat])
    setActiveChatId(firstChat.id)
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    try {
      localStorage.setItem(`chat_conversations_${businessId}`, JSON.stringify(conversations))
    } catch {
      // ignore
    }
  }, [conversations, businessId])

  useEffect(() => {
    if (!businessId || !activeChatId) return
    try {
      localStorage.setItem(`chat_active_${businessId}`, activeChatId)
    } catch {
      // ignore
    }
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
    const newChat = buildConversation()
    setConversations((prev) => [newChat, ...prev])
    setActiveChatId(newChat.id)
    setInputValue('')
    setRecordingError(null)
    clearImageAttachment()
    clearAudioAttachment()
  }

  function clearImageAttachment() {
    setImageFile(null)
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function clearAudioAttachment() {
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

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

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
      const newChat = buildConversation()
      setConversations((prev) => [newChat, ...prev])
      setActiveChatId(newChat.id)
      chatId = newChat.id
    }

    const chatSnapshot = conversations.find((chat) => chat.id === chatId) ?? {
      id: chatId,
      title: 'Nueva conversación',
      messages: [],
      createdAt: Date.now(),
    }

    const userAttachments: ChatAttachment[] = []
    if (imageFile) {
      userAttachments.push({
        id: `img_${Date.now()}`,
        kind: 'image',
        name: imageFile.name,
        type: imageFile.type,
        url: URL.createObjectURL(imageFile),
      })
    }
    if (audioBlob) {
      userAttachments.push({
        id: `aud_${Date.now()}`,
        kind: 'audio',
        name: `audio-${Date.now()}.webm`,
        type: audioBlob.type || 'audio/webm',
        url: URL.createObjectURL(audioBlob),
      })
    }

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: fixEncoding(trimmed || 'Mensaje multimodal'),
      attachments: userAttachments.length > 0 ? userAttachments : undefined,
    }

    const assistantId = `assistant_${Date.now() + 1}`
    const assistantMessage: Message = { id: assistantId, role: 'assistant', content: '' }
    const apiMessages = [...chatSnapshot.messages, userMessage].slice(-30).map(({ role, content }) => ({ role, content }))

    const shouldSetTitle = chatSnapshot.messages.length === 0 && chatSnapshot.title === 'Nueva conversación'
    const nextTitle = shouldSetTitle ? getTitleFromMessage(trimmed || 'Mensaje multimodal') : chatSnapshot.title

    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, title: nextTitle, messages: [...chat.messages, userMessage, assistantMessage] }
          : chat
      )
    )

    setInputValue('')
    clearImageAttachment()
    clearAudioAttachment()
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('business_id', businessId)
      formData.append('messages', JSON.stringify(apiMessages))
      formData.append('text', userMessage.content)
      if (imageFile) formData.append('image', imageFile)
      if (audioBlob) {
        formData.append(
          'audio',
          new File([audioBlob], `audio-${Date.now()}.webm`, { type: audioBlob.type || 'audio/webm' })
        )
      }

      const response = await fetch('/api/chat', { method: 'POST', body: formData })
      if (!response.ok || !response.body) throw new Error('Error en la respuesta')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setConversations((prev) =>
          prev.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
                }
              : chat
          )
        )
      }
    } catch {
      setConversations((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: chat.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: 'Ocurrio un error al generar la respuesta. Intenta de nuevo.' }
                    : m
                ),
              }
            : chat
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

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F8FA]">
      <aside className="hidden w-72 flex-col border-r border-[#E5E7EB] bg-white md:flex">
        <div className="border-b border-[#E5E7EB] p-4">
          <button
            onClick={createNewChat}
            className="flex w-full items-center justify-center rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
          >
            + Nueva conversación
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {conversations.map((chat) => {
            const isActive = chat.id === activeChatId
            return (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={[
                  'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  isActive
                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]'
                    : 'border-transparent bg-transparent text-[#374151] hover:border-[#E5E7EB] hover:bg-[#F9FAFB]',
                ].join(' ')}
              >
                <p className="truncate font-medium">{fixEncoding(chat.title)}</p>
                <p className="mt-1 text-xs text-[#4B5563]">{chat.messages.length} mensajes</p>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-5 md:px-8">
          <div>
            <h1 className="text-xl font-semibold text-[#111827]">Asistente IA</h1>
            <p className="text-sm text-[#374151]">Texto, imagen y voz en un solo chat</p>
          </div>
          <button
            onClick={createNewChat}
            className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
          >
            + Nueva conversación
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-[#E5E7EB] bg-white px-4 py-3 md:hidden">
          {conversations.map((chat) => {
            const isActive = chat.id === activeChatId
            return (
              <button
                key={chat.id}
                onClick={() => setActiveChatId(chat.id)}
                className={[
                  'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium',
                  isActive
                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]'
                    : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]',
                ].join(' ')}
              >
                {chat.title}
              </button>
            )
          })}
        </div>

        {!hasMessages ? (
          <div className="flex flex-1 items-center justify-center px-6 py-8 md:px-10">
            <div className="w-full max-w-2xl text-center">
              <p className="mb-2 text-2xl font-semibold text-[#111827]">En que puedo ayudarte hoy?</p>
              <p className="mb-6 text-sm text-[#374151]">
                Puedes escribir, adjuntar una imagen o enviar una nota de voz.
              </p>
              <div className="mb-6 grid grid-cols-1 gap-2 md:grid-cols-2">
                {QUICK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-left text-sm text-[#374151] transition-colors hover:border-[#2563EB]"
                  >
                    {s}
                  </button>
                ))}
              </div>
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
                onRemoveImage={clearImageAttachment}
                onRemoveAudio={clearAudioAttachment}
                textareaRef={textareaRef}
                imageInputRef={imageInputRef}
                onImageChange={handleImageUpload}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 md:px-10">
              {messages.map((message) => (
                <div key={message.id} className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mb-2 flex max-w-[72%] flex-wrap gap-2">
                      {message.attachments.map((att) =>
                        att.kind === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={att.id}
                            src={att.url}
                            alt={att.name}
                            className="h-28 w-40 rounded-lg border border-[#E5E7EB] object-cover"
                          />
                        ) : (
                          <audio
                            key={att.id}
                            controls
                            className="h-10 w-56 rounded-lg border border-[#E5E7EB] bg-white"
                            src={att.url}
                          />
                        )
                      )}
                    </div>
                  )}

                  <div
                    className={[
                      'max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-6',
                      message.role === 'user'
                        ? 'rounded-tr-[6px] bg-[#2563EB] text-white'
                        : 'rounded-tl-[6px] border border-[#E5E7EB] bg-white text-[#111827]',
                    ].join(' ')}
                  >
                    {message.role === 'assistant' ? renderMarkdown(fixEncoding(message.content)) : fixEncoding(message.content)}
                  </div>
                </div>
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-[#E5E7EB] bg-[#F7F8FA] px-6 py-4 md:px-10">
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
                onRemoveImage={clearImageAttachment}
                onRemoveAudio={clearAudioAttachment}
                textareaRef={textareaRef}
                imageInputRef={imageInputRef}
                onImageChange={handleImageUpload}
              />
            </div>
          </>
        )}
      </section>
    </div>
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
  return (
    <div className="w-full">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onImageChange}
      />

      {(imagePreviewUrl || audioPreviewUrl || recordingError) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {imagePreviewUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt={imageName ?? 'preview'} className="h-12 w-12 rounded-md object-cover" />
              <span className="max-w-[180px] truncate text-xs text-[#374151]">{imageName ?? 'Imagen'}</span>
              <button onClick={onRemoveImage} className="text-xs text-[#4B5563] hover:text-[#111827]">
                Quitar
              </button>
            </div>
          )}
          {audioPreviewUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 py-2">
              <audio controls src={audioPreviewUrl} className="h-8 w-52" />
              <button onClick={onRemoveAudio} className="text-xs text-[#4B5563] hover:text-[#111827]">
                Quitar
              </button>
            </div>
          )}
          {recordingError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">
              {recordingError}
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <button
          onClick={onOpenCamera}
          disabled={isLoading}
          className="rounded-lg p-2 text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827] disabled:cursor-not-allowed"
          aria-label="Subir imagen"
          title="Subir imagen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7a2 2 0 012-2h8a2 2 0 012 2v1l2-1h2v10h-2l-2-1v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>

        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isLoading}
          className={[
            'rounded-lg p-2 disabled:cursor-not-allowed',
            isRecording ? 'bg-red-50 text-red-600' : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]',
          ].join(' ')}
          aria-label={isRecording ? 'Detener grabacion' : 'Iniciar grabacion'}
          title={isRecording ? 'Detener grabacion' : 'Iniciar grabacion'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder={isRecording ? 'Grabando audio...' : 'Escribe tu mensaje...'}
          rows={1}
          disabled={isLoading}
          className="max-h-[120px] min-h-[26px] flex-1 resize-none overflow-hidden bg-transparent pt-1 text-sm text-[#111827] outline-none"
        />

        <button
          onClick={onSend}
          disabled={!canSend}
          className={[
            'flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold transition-colors',
            canSend
              ? 'border-[#1D4ED8] bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
              : 'border-[#E5E7EB] bg-[#F3F4F6] text-[#4B5563]',
          ].join(' ')}
          aria-label="Enviar mensaje"
          title="Enviar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 19V5M12 5l-6 6M12 5l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] text-[#4B5563]">
        Enter para enviar | Shift+Enter para nueva linea {isRecording ? '| grabando...' : ''}
      </p>
    </div>
  )
}
