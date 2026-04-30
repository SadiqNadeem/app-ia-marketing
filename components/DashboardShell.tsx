'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import type { Business } from '@/types'

interface DashboardShellProps {
  business: Business
  connectedNetworks: Array<{ platform: string; platform_username: string | null }>
  businessId: string
  userInitials: string
  businessName: string
  children: React.ReactNode
}

export function DashboardShell({
  business,
  connectedNetworks,
  businessId,
  userInitials,
  businessName,
  children,
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar business={business} connectedNetworks={connectedNetworks} />
      </div>

      {/* Mobile sidebar drawer */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 224,
              zIndex: 61,
            }}
          >
            <Sidebar
              business={business}
              connectedNetworks={connectedNetworks}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className="md:ml-[224px] shell-viewport"
        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <TopBar
          businessId={businessId}
          userInitials={userInitials}
          businessName={businessName}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main
          className="dashboard-content"
          style={{ flex: 1, overflowY: 'auto', background: '#F9FAFB' }}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav business={business} connectedNetworks={connectedNetworks} />
    </div>
  )
}
