'use client'

import { useRouter } from 'next/navigation'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

interface UpgradeModalProps {
  feature: string
  onClose: () => void
}

export function UpgradeModal({ feature, onClose }: UpgradeModalProps) {
  const router = useRouter()

  function handleViewPlans() {
    onClose()
    router.push('/pricing')
  }

  return (
    <Dialog open onClose={onClose} title="Funcion no disponible en tu plan">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[#374151]">
          Para acceder a <span className="font-medium text-[#111827]">{feature}</span> necesitas
          mejorar tu plan.
        </p>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={handleViewPlans}>
            Ver planes
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Ahora no
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

