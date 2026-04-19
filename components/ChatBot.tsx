'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatBotProps {
  businessId: string
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  role: 'assistant',
  content:
    'Hola. Soy tu asistente de marketing. Puedo ayudarte a crear contenido, disenar estrategias para redes sociales o resolver cualquier duda sobre la plataforma. En que puedo ayudarte hoy?',
}

const QUICK_SUGGESTIONS = [
  'Ideas para esta semana',
  'Como mejorar mi Instagram',
  'Genera un post para hoy',
  'Estrategia para mi negocio',
]

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          background: '#F7F8FA',
          borderRadius: '12px 12px 12px 4px',
          padding: '10px 14px',
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#4B5563',
              display: 'inline-block',
              animation: 'chatbotDot 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function ChatBot({ businessId }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const storageKey = `chat_${businessId}`

  // Load persisted messages from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: Message[] = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [storageKey])

  // Persist messages to localStorage (keep last 20)
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'initial') return
    try {
      const toStore = messages.slice(-20)
      localStorage.setItem(storageKey, JSON.stringify(toStore))
    } catch {
      // ignore storage errors
    }
  }, [messages, storageKey])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 72) + 'px'
  }

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      const userMessage: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: trimmed,
      }

      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: '',
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setInputValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
      setIsLoading(true)

      try {
        // Build messages array for API (exclude initial greeting, limit to last 20)
        const apiMessages = [...messages, userMessage]
          .filter((m) => m.id !== 'initial')
          .slice(-20)
          .map(({ role, content }) => ({ role, content }))

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify({ messages: apiMessages, business_id: businessId }),
        })

        if (!response.ok || !response.body) {
          throw new Error('Error en la respuesta del servidor')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          accumulated += decoder.decode(value, { stream: true })
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, content: accumulated } : m
            )
          )
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: 'Ocurrio un error. Por favor intenta de nuevo.' }
              : m
          )
        )
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading, messages, businessId]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const hasUserMessages = messages.some((m) => m.role === 'user')
  const canSend = inputValue.trim().length > 0 && !isLoading

  return (
    <>
      <style>{`
        @keyframes chatbotDot {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Abrir asistente de marketing"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 50,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: '#2563EB',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.4)'
        }}
      >
        {isOpen ? (
          // X icon
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4L16 16M16 4L4 16" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          // Chat bubble icon
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="2" width="18" height="14" rx="3" stroke="white" strokeWidth="1.8" />
            <path d="M5 18L8 15H13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '24px',
            zIndex: 50,
            width: '380px',
            height: '520px',
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: '#2563EB',
              borderRadius: '16px 16px 0 0',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'white', lineHeight: 1.3 }}>
                Asistente de marketing
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                Preguntame cualquier cosa
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar chat"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'white',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                opacity: 0.8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius:
                      message.role === 'user'
                        ? '12px 12px 4px 12px'
                        : '12px 12px 12px 4px',
                    background: message.role === 'user' ? '#2563EB' : '#F7F8FA',
                    color: message.role === 'user' ? 'white' : '#111827',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {message.content || (message.role === 'assistant' && isLoading ? '' : message.content)}
                </div>
              </div>
            ))}

            {/* Quick suggestions (only before first user message) */}
            {!hasUserMessages && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    style={{
                      background: '#F7F8FA',
                      border: '1px solid #E5E7EB',
                      borderRadius: '20px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      color: '#374151',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2563EB'
                      e.currentTarget.style.color = '#2563EB'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB'
                      e.currentTarget.style.color = '#374151'
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {isLoading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '12px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta..."
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                overflow: 'hidden',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                color: '#111827',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                minHeight: '36px',
                maxHeight: '72px',
                background: 'white',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#2563EB' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={!canSend}
              aria-label="Enviar mensaje"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#2563EB',
                border: 'none',
                cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: canSend ? 1 : 0.5,
                transition: 'opacity 0.15s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 13L13 7L1 1V5.5L9 7L1 8.5V13Z"
                  fill="white"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}


