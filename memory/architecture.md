# Arquitectura del proyecto

## Estructura de carpetas
/app                  → rutas y paginas (App Router)
/app/api              → API routes del backend
/app/(auth)           → rutas de login, registro, onboarding
/app/dashboard        → rutas protegidas del dashboard
/components           → componentes reutilizables
/components/ui        → componentes base (Button, Card, Input, Badge, PageHeader)
/lib                  → clientes y utilidades
/lib/supabase.ts      → cliente Supabase para cliente y servidor
/lib/openai.ts        → cliente OpenAI
/lib/tokens.ts        → funciones de refresco de tokens OAuth
/types                → tipos TypeScript globales
/memory               → este sistema de memoria

## Tablas en Supabase
- businesses: datos del negocio, logo, colores, plan, stripe_customer_id
- business_knowledge: documentos de conocimiento del negocio (pdf, audio, text, interview). Sustituye a ai_context.
- social_connections: tokens OAuth por plataforma y negocio
- posts: contenido generado, estado (draft/scheduled/published/failed)
- content_library: biblioteca de flyers, posts, stories guardados
- customers: clientes del negocio con sistema de puntos

## Seguridad
- RLS activado en todas las tablas
- Tokens OAuth cifrados con Supabase Vault
- Middleware Next.js protege todas las rutas /dashboard
