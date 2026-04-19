export interface EmailTemplateParams {
  business: {
    name: string
    logo_url?: string | null
    primary_color?: string | null
  }
  subject: string
  headline: string
  body: string
  cta_text?: string | null
  cta_url?: string | null
  footer_text?: string | null
  unsubscribe_url: string
}

export function buildEmailHtml({
  business,
  headline,
  body,
  cta_text,
  cta_url,
  footer_text,
  unsubscribe_url,
}: EmailTemplateParams): string {
  const primaryColor = business.primary_color || '#2563EB'
  const showCta = cta_text && cta_url

  const logoBlock = business.logo_url
    ? `<img src="${escHtml(business.logo_url)}" alt="${escHtml(business.name)}" width="120" style="display:block;margin:0 auto 8px;max-height:60px;object-fit:contain;" />`
    : ''

  const ctaBlock = showCta
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px">
        <tr>
          <td align="center">
            <a href="${escHtml(cta_url!)}"
               style="display:inline-block;background-color:${escHtml(primaryColor)};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;line-height:1.4">
              ${escHtml(cta_text!)}
            </a>
          </td>
        </tr>
      </table>`
    : ''

  const footerContent = footer_text
    ? `<p style="margin:0 0 8px;font-size:12px;color:#4B5563;font-family:Arial,sans-serif;line-height:1.5">${escHtml(footer_text)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F8FA;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA">
    <tr>
      <td align="center" style="padding:32px 16px">

        <!-- Outer container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #E5E7EB">

          <!-- Header -->
          <tr>
            <td style="background-color:${escHtml(primaryColor)};padding:24px 32px;text-align:center">
              ${logoBlock}
              <p style="margin:0;color:#ffffff;font-family:Arial,sans-serif;font-size:18px;font-weight:700;line-height:1.3">${escHtml(business.name)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#111827;font-family:Arial,sans-serif;font-size:16px;line-height:1.6">
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;font-family:Arial,sans-serif;line-height:1.3">${escHtml(headline)}</h1>
              <div style="color:#374151;font-family:Arial,sans-serif;font-size:16px;line-height:1.6">${body}</div>
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F7F8FA;padding:20px 32px;text-align:center;border-top:1px solid #E5E7EB">
              ${footerContent}
              <p style="margin:0;font-size:12px;color:#4B5563;font-family:Arial,sans-serif;line-height:1.5">
                <a href="${escHtml(unsubscribe_url)}" style="color:#4B5563;text-decoration:underline">Darse de baja</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Outer container -->

      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildPlainText({
  headline,
  body,
  cta_text,
  cta_url,
  footer_text,
}: {
  headline: string
  body: string
  cta_text?: string | null
  cta_url?: string | null
  footer_text?: string | null
}): string {
  // Strip basic HTML tags from body for plain text version
  const plainBody = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const lines: string[] = [headline, '', plainBody]

  if (cta_text && cta_url) {
    lines.push('', `${cta_text}: ${cta_url}`)
  }

  if (footer_text) {
    lines.push('', '---', footer_text)
  }

  return lines.join('\n')
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

