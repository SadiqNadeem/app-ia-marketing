'use client'

import { ChevronLeft, Video, Phone, MoreVertical, CheckCheck, Mic } from 'lucide-react'

interface WhatsAppPreviewProps {
  businessName: string
  message: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function currentTime(): string {
  const now = new Date()
  return now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

const WA_PATTERN = "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.12'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"

export function WhatsAppPreview({ businessName, message }: WhatsAppPreviewProps) {
  const displayName = businessName.trim() || 'Mi Negocio'
  const hasMessage = message.trim().length > 0

  return (
    <div
      style={{
        width: '280px',
        margin: '0 auto',
        background: '#1A1A1A',
        borderRadius: '36px',
        padding: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 0 0 2px #333',
      }}
    >
      {/* Screen */}
      <div
        style={{
          background: '#ECE5DD',
          borderRadius: '26px',
          overflow: 'hidden',
          height: '480px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#075E54',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <ChevronLeft size={18} color="white" style={{ opacity: 0.8, flexShrink: 0 }} />

          {/* Avatar */}
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>
              {getInitials(displayName)}
            </span>
          </div>

          {/* Contact info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'white',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              en linea
            </p>
          </div>

          {/* Right icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: 'auto' }}>
            <Video size={17} color="white" style={{ opacity: 0.8 }} />
            <Phone size={17} color="white" style={{ opacity: 0.8 }} />
            <MoreVertical size={17} color="white" style={{ opacity: 0.8 }} />
          </div>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            background: '#ECE5DD',
            backgroundImage: WA_PATTERN,
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Date chip */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <span
              style={{
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '8px',
                padding: '3px 10px',
                fontSize: '11px',
                color: '#667781',
              }}
            >
              Hoy
            </span>
          </div>

          {/* Message bubble */}
          {hasMessage ? (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '0 10px 10px 10px',
                padding: '8px 10px 6px',
                maxWidth: '85%',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                display: 'inline-block',
              }}
            >
              <p
                style={{
                  fontSize: '13.5px',
                  color: '#111',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {message}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px',
                  marginTop: '4px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#667781' }}>{currentTime()}</span>
                <CheckCheck size={14} color="#53BDEB" />
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '0 10px 10px 10px',
                padding: '8px 10px 6px',
                maxWidth: '85%',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                display: 'inline-block',
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  color: '#aaa',
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                El mensaje que escribas aparecera aqui
              </p>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div
          style={{
            background: '#F0F0F0',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '24px',
              flex: 1,
              padding: '8px 14px',
              fontSize: '13px',
              color: '#aaa',
            }}
          >
            Escribe un mensaje
          </div>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Mic size={18} color="white" />
          </div>
        </div>
      </div>
    </div>
  )
}
