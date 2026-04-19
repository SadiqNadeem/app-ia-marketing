'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { SocialPlatform } from '@/types'

interface DisconnectButtonProps {
  platform: SocialPlatform
}

export function DisconnectButton({ platform }: DisconnectButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDisconnect() {
    setLoading(true)
    try {
      await fetch('/api/auth/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ platform }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={handleDisconnect}
    >
      Desconectar
    </Button>
  )
}
