'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden')
      return
    }

    if (password.length < 8) {
      setError('La contrasena debe tener al menos 8 caracteres')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(`/auth/verify-email?email=${encodeURIComponent(email)}`)
  }

  return (
    <Card
      className="w-full"
      padding="lg"
      style={{
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        borderRadius: 16,
      }}
    >
      <div className="flex flex-col gap-6">
        {/* Brand */}
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold text-brand-primary">Publify</span>
          <h1 className="text-xl font-semibold text-brand-text-primary">Crea tu cuenta</h1>
          <p className="text-sm text-brand-text-secondary">
            Empieza a generar contenido para tu negocio
          </p>
        </div>

        {/* Error */}
        {error && (
          <Badge variant="error" className="w-full justify-center py-2 rounded-lg text-xs">
            {error}
          </Badge>
        )}

        {/* Form */}
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
          <Input
            label="Contrasena"
            type="password"
            placeholder="Minimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <Input
            label="Repite la contrasena"
            type="password"
            placeholder="Repite tu contrasena"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} className="w-full mt-2">
            Crear cuenta
          </Button>
        </form>

        {/* Footer */}
        <p className="text-sm text-center text-brand-text-secondary">
          Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="text-brand-primary font-medium hover:underline transition-colors duration-150"
          >
            Inicia sesion
          </Link>
        </p>
      </div>
    </Card>
  )
}
