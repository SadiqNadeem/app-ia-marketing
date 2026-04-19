'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { UpgradeModal } from '@/components/UpgradeModal'

interface ConnectButtonProps {
  connectHref: string
  canConnect: boolean
}

export function ConnectButton({ connectHref, canConnect }: ConnectButtonProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const router = useRouter()

  function handleClick() {
    if (!canConnect) {
      setShowUpgrade(true)
      return
    }
    window.location.href = connectHref
  }

  return (
    <>
      <Button size="sm" className="w-full" onClick={handleClick}>
        Conectar
      </Button>
      {showUpgrade && (
        <UpgradeModal
          feature="mas redes sociales conectadas"
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  )
}
