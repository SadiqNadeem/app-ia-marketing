import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────────
  let body: { id: string; business_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { id, business_id } = body
  if (!id || !business_id) {
    return NextResponse.json({ error: 'Faltan campos: id, business_id' }, { status: 400 })
  }

  // ── 3. Verify ownership and get file info ──────────────────────
  const { data: record, error: fetchError } = await supabase
    .from('business_knowledge')
    .select('id, original_file_url, business_id')
    .eq('id', id)
    .eq('business_id', business_id)
    .single()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Documento no encontrado o sin permiso' }, { status: 404 })
  }

  // ── 4. Delete from Storage if there's a file ───────────────────
  if (record.original_file_url) {
    try {
      // Extract the storage path from the URL
      const url = new URL(record.original_file_url)
      const pathParts = url.pathname.split('/storage/v1/object/public/knowledge/')
      if (pathParts[1]) {
        await supabase.storage.from('knowledge').remove([pathParts[1]])
      }
    } catch {
      // Non-fatal: proceed with DB deletion even if file removal fails
      console.warn('[knowledge/delete] could not remove storage file')
    }
  }

  // ── 5. Delete from DB (RLS enforces ownership) ─────────────────
  const { error: deleteError } = await supabase
    .from('business_knowledge')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[knowledge/delete] delete error:', deleteError)
    return NextResponse.json({ error: 'Error al eliminar el documento' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
