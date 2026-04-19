import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_TEXT_LENGTH = 8000

function cleanText(raw: string): string {
  return raw
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse form data ─────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formulario invalido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const business_id = formData.get('business_id') as string | null
  const title = formData.get('title') as string | null

  if (!file || !business_id || !title) {
    return NextResponse.json({ error: 'Faltan campos: file, business_id, title' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'El archivo debe ser un PDF' }, { status: 400 })
  }

  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'El PDF no puede superar los 10 MB' }, { status: 400 })
  }

  // ── 3. Verify business ownership ───────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // ── 4. Upload PDF to storage ────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${business_id}/pdf/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await supabase.storage
    .from('knowledge')
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    console.error('[knowledge/upload-pdf] storage error:', uploadError)
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('knowledge').getPublicUrl(storagePath)
  const original_file_url = urlData.publicUrl

  // ── 5. Extract text with pdf-parse ─────────────────────────────
  let extractedText = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    extractedText = cleanText(data.text)
  } catch (err) {
    console.error('[knowledge/upload-pdf] pdf-parse error:', err)
    return NextResponse.json({ error: 'Error al extraer el texto del PDF' }, { status: 500 })
  }

  if (!extractedText) {
    return NextResponse.json({ error: 'No se pudo extraer texto del PDF. Asegurate de que no sea un PDF escaneado.' }, { status: 400 })
  }

  // ── 6. Save to business_knowledge ─────────────────────────────
  const { data: record, error: insertError } = await supabase
    .from('business_knowledge')
    .insert({
      business_id,
      type: 'pdf',
      title: title.trim(),
      original_file_url,
      extracted_text: extractedText,
      file_size_kb: Math.round(file.size / 1024),
    })
    .select('id')
    .single()

  if (insertError || !record) {
    console.error('[knowledge/upload-pdf] insert error:', insertError)
    return NextResponse.json({ error: 'Error al guardar el documento' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    id: record.id,
    extracted_text_preview: extractedText.slice(0, 200),
  })
}
