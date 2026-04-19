'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  return (
    <Card className="w-full max-w-[400px]" padding="lg">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold text-brand-primary">MarketingIA</span>
          <h1 className="text-xl font-semibold text-brand-text-primary">Recuperar contraseña</h1>
          <p className="text-sm text-brand-text-secondary">
            Te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        {error && (
          <Badge variant="error" className="w-full justify-center py-2 rounded-lg text-xs">
            {error}
          </Badge>
        )}

        {sent ? (
          <div className="flex flex-col gap-4">
            <Badge variant="success" className="w-full justify-center py-3 rounded-lg text-xs">
              Revisa tu email — te hemos enviado el enlace de recuperación
            </Badge>
            <p className="text-xs text-brand-text-secondary text-center">
              Si no lo ves, mira la carpeta de spam
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Button type="submit" loading={loading} className="w-full mt-2">
              Enviar enlace
            </Button>
          </form>
        )}

        <p className="text-sm text-center text-brand-text-secondary">
          <Link
            href="/login"
            className="text-brand-primary font-medium hover:underline transition-colors duration-150"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </Card>
  )
}
