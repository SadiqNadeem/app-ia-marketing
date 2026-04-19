'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-[400px]" padding="lg">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold text-brand-primary">MarketingIA</span>
          <h1 className="text-xl font-semibold text-brand-text-primary">Nueva contraseña</h1>
          <p className="text-sm text-brand-text-secondary">
            Elige una contraseña segura para tu cuenta
          </p>
        </div>

        {error && (
          <Badge variant="error" className="w-full justify-center py-2 rounded-lg text-xs">
            {error}
          </Badge>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Nueva contraseña"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            placeholder="Repite la contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} className="w-full mt-2">
            Guardar contraseña
          </Button>
        </form>

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
