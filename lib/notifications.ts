import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export type NotificationType =
  | 'post_published'
  | 'post_failed'
  | 'coupon_redeemed'
  | 'review_new'
  | 'review_negative'
  | 'trend_available'
  | 'token_expiring'

interface CreateNotificationParams {
  business_id: string
  type: NotificationType
  title: string
  message: string
  link?: string
  sendEmail?: boolean
  userEmail?: string
}

function buildEmailHtml(title: string, message: string, link?: string): string {
  const buttonHtml = link
    ? `<div style="margin-top:24px;text-align:center">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}${link}"
           style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;
                  padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">
          Ver en la app
        </a>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;
              border:1px solid #E5E7EB;overflow:hidden">
    <div style="background:#2563EB;padding:20px 32px">
      <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600;letter-spacing:0.025em">
        Publify
      </p>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827">${title}</h1>
      <p style="margin:0;font-size:16px;color:#374151;line-height:1.6">${message}</p>
      ${buttonHtml}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E5E7EB;background:#F7F8FA">
      <p style="margin:0;font-size:12px;color:#4B5563;text-align:center">
        Puedes gestionar tus notificaciones desde la app
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function createNotification({
  business_id,
  type,
  title,
  message,
  link,
  sendEmail = false,
  userEmail,
}: CreateNotificationParams): Promise<void> {
  const admin = createAdminClient()

  // Insert notification (fire and don't block on error)
  const { error } = await admin
    .from('notifications')
    .insert({ business_id, type, title, message, link: link ?? null })

  if (error) {
    console.error('[notifications] Insert error:', error)
  }

  // Send email if requested
  if (sendEmail && userEmail) {
    try {
      await getResend().emails.send({
        from: 'Publify <notificaciones@marketingia.app>',
        to: userEmail,
        subject: title,
        html: buildEmailHtml(title, message, link),
      })
    } catch (emailErr) {
      console.error('[notifications] Email error:', emailErr)
    }
  }
}

// ── Pre-configured helpers ────────────────────────────────────────

export async function notifyPostPublished(
  business_id: string,
  platforms: string[]
): Promise<void> {
  await createNotification({
    business_id,
    type: 'post_published',
    title: 'Publicacion realizada',
    message: `Tu contenido se ha publicado correctamente en ${platforms.join(', ')}`,
    link: '/dashboard/posts',
    sendEmail: false,
  })
}

export async function notifyPostFailed(
  business_id: string,
  error: string,
  userEmail: string
): Promise<void> {
  await createNotification({
    business_id,
    type: 'post_failed',
    title: 'Error al publicar',
    message: `No se pudo publicar tu contenido: ${error}`,
    link: '/dashboard/posts',
    sendEmail: true,
    userEmail,
  })
}

export async function notifyCouponRedeemed(
  business_id: string,
  couponTitle: string
): Promise<void> {
  await createNotification({
    business_id,
    type: 'coupon_redeemed',
    title: 'Cupon canjeado',
    message: `Se ha canjeado el cupon "${couponTitle}"`,
    link: '/dashboard/coupons',
    sendEmail: false,
  })
}

export async function notifyNewReview(
  business_id: string,
  stars: number,
  userEmail: string
): Promise<void> {
  const isNegative = stars <= 2
  await createNotification({
    business_id,
    type: isNegative ? 'review_negative' : 'review_new',
    title: isNegative ? 'Resena negativa en Google' : 'Nueva resena en Google',
    message: isNegative
      ? `Has recibido una resena de ${stars} estrellas. Te recomendamos responder pronto.`
      : `Has recibido una nueva resena de ${stars} estrellas en Google Business.`,
    link: '/dashboard/reviews',
    sendEmail: isNegative,
    userEmail,
  })
}

export async function notifyTrendAvailable(business_id: string): Promise<void> {
  await createNotification({
    business_id,
    type: 'trend_available',
    title: 'Ideas de contenido para esta semana',
    message: 'La IA ha generado 3 ideas de contenido adaptadas a tu negocio para esta semana.',
    link: '/dashboard',
    sendEmail: false,
  })
}

export async function notifyTokenExpiring(
  business_id: string,
  platform: string,
  userEmail: string
): Promise<void> {
  await createNotification({
    business_id,
    type: 'token_expiring',
    title: `Token de ${platform} expira pronto`,
    message: `La conexion con ${platform} expirara en menos de 7 dias. Reconecta tu cuenta para evitar interrupciones.`,
    link: '/dashboard/connections',
    sendEmail: true,
    userEmail,
  })
}

