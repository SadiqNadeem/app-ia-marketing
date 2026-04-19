'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-[400px]" padding="lg">
      <div className="flex flex-col gap-6">
        {/* Brand */}
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold text-brand-primary">MarketingIA</span>
          <h1 className="text-xl font-semibold text-brand-text-primary">Inicia sesion</h1>
          <p className="text-sm text-brand-text-secondary">
            Gestiona el marketing de tu negocio
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
            placeholder="Tu contrasena"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="flex justify-end -mt-2">
            <Link
              href="/forgot-password"
              className="text-xs text-brand-text-secondary hover:text-brand-primary transition-colors duration-150"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Button type="submit" loading={loading} className="w-full mt-2">
            Entrar
          </Button>
        </form>

        {/* Footer */}
        <p className="text-sm text-center text-brand-text-secondary">
          No tienes cuenta?{' '}
          <Link
            href="/register"
            className="text-brand-primary font-medium hover:underline transition-colors duration-150"
          >
            Registrate
          </Link>
        </p>
      </div>
    </Card>
  )
}
