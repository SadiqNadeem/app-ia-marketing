import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// DEV: bypass auth — returns the first real user via service role key
async function createBypassClient() {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
  const devUser = data?.users?.[0] ?? null

  // Proxy: intercepts auth.getUser() — all other calls go to the real service-role client
  return new Proxy(admin, {
    get(target, prop) {
      if (prop === 'auth') {
        return new Proxy(target.auth, {
          get(authTarget, authProp) {
            if (authProp === 'getUser') {
              return () => Promise.resolve({ data: { user: devUser }, error: null })
            }
            return (authTarget as unknown as Record<string | symbol, unknown>)[authProp]
          },
        })
      }
      return (target as unknown as Record<string | symbol, unknown>)[prop]
    },
  }) as ReturnType<typeof createAdminClient>
}

export async function createClient() {
  if (process.env.DEV_BYPASS_AUTH === 'true') {
    return createBypassClient()
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies will be set by middleware
          }
        },
      },
    }
  )
}
