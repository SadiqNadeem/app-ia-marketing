# Progreso del desarrollo

## Estado actual
- [x] Prompt -1: Carpeta de memoria
- [x] Prompt 00: Sistema de diseno
- [x] Prompt 01: Estructura Next.js + Supabase
- [x] Prompt 02: Esquema base de datos Supabase
- [x] Prompt 03: Auth y onboarding
- [x] Prompt 04: Generador de texto con OpenAI
- [x] Prompt 05: Generador de imagenes y editor de flyers
- [x] Prompt 06: OAuth Meta (Instagram + Facebook)
- [x] Prompt 07: OAuth TikTok + Google Business
- [x] Prompt 08: Publicacion y programador de posts
- [x] Prompt 09: Dashboard y biblioteca de contenido
- [x] Prompt 10: Stripe y planes de suscripcion

## Prompt 11 - Chatbot en pagina dedicada /dashboard/chat

## Decisiones tomadas
- Tailwind v4: no hay tailwind.config.ts. Los tokens de color brand-* se definen en globals.css con @theme. Equivalente al extend.colors de v3.
- @supabase/auth-helpers-nextjs instalado pero deprecado; la implementacion real usa @supabase/ssr con createBrowserClient / createServerClient.
- shadcn/ui no se instala via npm sino mediante CLI (npx shadcn@latest init). Se inicializara cuando se construya la primera pagina con componentes shadcn.
- Supabase images: se usa remotePatterns con hostname **.supabase.co (wildcard) en lugar de images.domains (deprecated en Next.js 14+).
- Onboarding: usa 'use client' completo con verificacion de negocio existente en useEffect al montar. Si ya existe business → redirige a /dashboard sin mostrar el formulario.
- Middleware actualizado: / redirige segun sesion; AUTH_PAGES redirigen a /dashboard si ya hay sesion; /onboarding protegido igual que /dashboard.
- TextGenerator acepta onPlatformChange opcional para sincronizar el preview con la plataforma seleccionada.
- dashboard/create usa patron Server Component (fetch negocio) + Client Component (interactividad). PostPreview es sticky en desktop.
- FlyerEditor: canvas es un div 540x540 (50% de 1080x1080). html2canvas se importa dinamicamente (import()) para evitar SSR. crossOrigin="anonymous" en imagenes para evitar CORS en html2canvas.
- La API /generate/image descarga la imagen temporal de OpenAI y la re-sube a Supabase Storage antes de devolver la URL, evitando que la URL de OpenAI expire.
- Guardar en biblioteca sube el PNG renderizado por html2canvas e inserta en content_library con tags [promotionType, style].
- lib/supabase/admin.ts: cliente con service role key (sin autoRefreshToken ni persistSession). Solo usar server-side.
- Callback Meta: upsert via admin client para bypasar RLS. Guarda tanto Instagram (page_access_token) como Facebook (long_lived_token) en una sola llamada.
- getValidToken re-fetch tras refreshMetaToken para devolver el token actualizado si fue renovado.
- DisconnectButton es Client Component que llama DELETE /api/auth/disconnect y hace router.refresh() para re-render del Server Component padre.
- TikTok PKCE: code_verifier = crypto.randomBytes(64).toString('base64url'), code_challenge = SHA-256 digest base64url. Verifier guardado en cookie httpOnly tiktok_cv (maxAge 10min), borrada al finalizar el callback.
- Google callback usa googleapis oauth2Client.getToken(code) para el intercambio. Llama a mybusinessaccountmanagement y mybusinessbusinessinformation para obtener la primera ubicacion.
- tokens.ts reescrito con refreshTikTokToken y refreshGoogleToken. getValidToken cubre las 4 plataformas y siempre re-fetcha tras refrescar para devolver el token actualizado.
- publishToInstagram hace dos llamadas: POST /media (crear contenedor con image_url) y POST /media_publish (publicar contenedor). Requiere imagen.
- publishToPlatform es un dispatcher centralizado que se usa tanto en /api/publish como en /api/cron/publish.
- Cron verifica Authorization: Bearer {CRON_SECRET} antes de cualquier operacion. Usa admin client para leer posts con RLS desactivado.
- PostScheduler carga conexiones activas en useEffect y deshabilita checkboxes de plataformas no conectadas. Valida que la fecha programada sea al menos 10min en el futuro.
- Posts page: patron Server Component (fetch) + PostsClient (tabs, tabla, modales). Scheduler y error modal son overlays en el mismo Client Component.

- Dashboard layout usa layout.tsx Server Component que obtiene el negocio y redirige a /onboarding si no existe. El Sidebar es Client Component con usePathname para el link activo.
- Badge recibe nueva variante "warning" (amber) para el plan agency.
- ContentLibraryItem y ContentItemType añadidos a types/index.ts.
- Dialog es un componente custom sin radix (backdrop + Escape + body scroll lock).
- LibraryClient filtra por tipo en cliente con tabs sin recargar. Modal de publicacion usa Dialog + PostScheduler.
- create/page.tsx lee searchParam promotion_type y lo pasa como initialPromotionType a CreatePageClient → TextGenerator (preselecciona contentType='promotion') y FlyerEditor.
- Settings dividido en 3 Cards con guardado independiente. Card Cuenta incluye resetPasswordForEmail y signOut.

- Stripe: stripe.ts exporta PLANS (as const) y planFromPriceId (reverse-lookup priceId → plan key). Webhook usa request.text() para body raw + stripe.webhooks.constructEvent para verificar firma.
- plans.ts usa admin client (service role) para bypasar RLS en checkCanPublish y checkCanConnectSocial.
- /api/publish devuelve 403 con reason cuando checkCanPublish falla. PostScheduler detecta 403 y muestra UpgradeModal en lugar del feedback de error normal.
- Los 3 connect routes (meta/tiktok/google) redirigen a /pricing?reason=limit si checkCanConnectSocial falla.
- ConnectButton es Client Component en connections page; muestra UpgradeModal si !canConnect antes de navegar al OAuth flow.
- /pricing es Server Component publico. Intenta obtener el plan del usuario pero no redirige si no hay sesion. PricingClient maneja el checkout (fetch POST /api/stripe/checkout → window.location.href = url).

- [x] Prompt 11: Chatbot de IA en pagina dedicada /dashboard/chat con sidebar link
- [x] Prompt 12: Contexto de negocio para IA completado (reemplazado por Prompt 13)
- [x] Prompt 13: Base de conocimiento completada

## Proyecto completado

Fecha: 2026-04-05

Todos los modulos implementados (Prompts -1 a 10). El proyecto es una app SaaS de marketing con IA completa:
- Auth y onboarding con Supabase
- Generador de texto e imagenes con OpenAI
- OAuth para Instagram, Facebook, TikTok y Google Business
- Publicacion inmediata y programada via cron
- Dashboard con biblioteca de contenido
- Pagos y planes con Stripe

## Problemas resueltos
(ir anotando aqui bugs o bloqueos que se hayan resuelto y como)
