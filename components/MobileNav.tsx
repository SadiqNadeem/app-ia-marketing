'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Plus, FileText, Users, Menu, X } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import type { Business } from '@/types'

interface MobileNavProps {
  business: Business
  connectedNetworks?: Array<{ platform: string; platform_username: string | null }>
}

const TABS = [
  { label: 'Inicio',         href: '/dashboard',          Icon: LayoutDashboard },
  { label: 'Crear',          href: '/dashboard/create',   Icon: Plus, isCenter: true },
  { label: 'Publicaciones',  href: '/dashboard/posts',    Icon: FileText },
  { label: 'Clientes',       href: '/dashboard/customers',Icon: Users },
] as const

export function MobileNav({ business, connectedNetworks = [] }: MobileNavProps) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* Bottom nav bar — only visible on mobile */}
      <nav
        className="mobile-nav fixed bottom-0 left-0 right-0 z-50 flex md:hidden"
        style={{
          background: '#111827',
          borderTop: '1px solid #1F2937',
          height: 60,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {TABS.map((tab) => {
          if ('isCenter' in tab && tab.isCenter) {
            return (
              <Link
                key="create"
                href="/dashboard/create"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: -20,
                    boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={22} color="#fff" strokeWidth={2.5} />
                </div>
              </Link>
            )
          }

          const isActive =
            tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                color: isActive ? '#2563EB' : '#6B7280',
                textDecoration: 'none',
              }}
            >
              <tab.Icon size={20} />
              <span style={{ fontSize: 10, fontWeight: 500 }}>{tab.label}</span>
            </Link>
          )
        })}

        {/* Menu tab — opens drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6B7280',
          }}
        >
          <Menu size={20} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>Menu</span>
        </button>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden">
          {/* Dark overlay */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 55,
            }}
          />

          {/* Drawer panel */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              zIndex: 60,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                position: 'absolute',
                top: 14,
                right: -44,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#fff',
                zIndex: 61,
              }}
            >
              <X size={16} />
            </button>

            <Sidebar
              business={business}
              connectedNetworks={connectedNetworks}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
