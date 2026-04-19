# Variables de entorno necesarias

## Archivo .env.local (nunca subir a git)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
META_APP_ID=
META_APP_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=

## Notas
- META_APP_ID y META_APP_SECRET se obtienen en developers.facebook.com
- TIKTOK_CLIENT_KEY se obtiene en developers.tiktok.com
- GOOGLE_CLIENT_ID se obtiene en console.cloud.google.com
- CRON_SECRET es una cadena aleatoria que tu mismo defines para proteger el endpoint del cron
