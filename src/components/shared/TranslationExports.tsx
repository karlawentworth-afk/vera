import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { generateTmx, generateTbx, generateXliff, parseTbx, downloadFile } from '../../lib/translationFormats'
import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

/**
 * TMX Export button — exports delivered job segments as translation memory.
 */
export function TmxExportButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const { data: jobs } = await supabase.from('jobs').select('id, job_number, source_language, target_language, content_type, delivered_at')
        .eq('organisation_id', orgId).eq('status', 'delivered').eq('is_demo', getIsDemo())
      const jobIds = jobs?.map(j => j.id) ?? []
      if (jobIds.length === 0) { alert('No delivered jobs to export'); return }

      const { data: segments } = await supabase.from('job_segments').select('job_id, source_text, reviewer_translation, ai_translation')
        .in('job_id', jobIds).order('segment_index')

      const jobMap = Object.fromEntries(jobs!.map(j => [j.id, j]))
      const units = (segments ?? []).map(s => {
        const j = jobMap[s.job_id]
        return {
          source: s.source_text,
          target: s.reviewer_translation ?? s.ai_translation,
          sourceLang: j?.source_language ?? 'EN',
          targetLang: j?.target_language ?? 'DE',
          date: j?.delivered_at,
          project: j?.job_number,
          contentType: j?.content_type,
        }
      })

      const tmx = generateTmx({ orgName, units })
      downloadFile(tmx, `${orgName.toLowerCase().replace(/\s+/g, '-')}-translation-memory.tmx`)
    } finally { setLoading(false) }
  }

  return (
    <button onClick={handleExport} disabled={loading} className="text-xs border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
      <Download className="w-3 h-3" /> {loading ? 'Exporting...' : 'Export TMX'}
    </button>
  )
}

/**
 * TBX Export button — exports glossary as terminology database.
 */
export function TbxExportButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { data: entries } = useQuery({
    queryKey: ['tbx-glossary', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('glossary_entries').select('source_term, target_language, preferred_translation, do_not_translate, notes')
        .eq('organisation_id', orgId).eq('is_demo', getIsDemo())
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  function handleExport() {
    if (!entries?.length) { alert('No glossary entries to export'); return }
    const tbx = generateTbx({
      orgName,
      entries: entries.map(e => ({
        sourceTerm: e.source_term,
        targetLang: e.target_language,
        translation: e.preferred_translation,
        doNotTranslate: e.do_not_translate,
        notes: e.notes ?? undefined,
      })),
    })
    downloadFile(tbx, `${orgName.toLowerCase().replace(/\s+/g, '-')}-terminology.tbx`)
  }

  return (
    <button onClick={handleExport} disabled={!entries?.length} className="text-xs border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
      <Download className="w-3 h-3" /> Export TBX
    </button>
  )
}

/**
 * TBX Import button — imports terminology from TBX file.
 */
export function TbxImportButton({ orgId, onImported }: { orgId: string; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleFile(file: File) {
    setImporting(true)
    try {
      const xml = await file.text()
      const entries = parseTbx(xml)
      if (entries.length === 0) { alert('No terms found in TBX file'); return }

      const { error } = await supabase.from('glossary_entries').insert(
        entries.map(e => ({
          organisation_id: orgId,
          source_term: e.sourceTerm,
          target_language: e.targetLang,
          preferred_translation: e.translation,
          do_not_translate: e.doNotTranslate ?? false,
          notes: e.notes ?? null,
        }))
      )
      if (error) throw error
      alert(`${entries.length} terms imported`)
      onImported()
    } catch (err) {
      alert('Import failed: ' + err)
    } finally { setImporting(false) }
  }

  return (
    <>
      <button onClick={() => fileRef.current?.click()} disabled={importing} className="text-xs border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
        <Upload className="w-3 h-3" /> {importing ? 'Importing...' : 'Import TBX'}
      </button>
      <input ref={fileRef} type="file" accept=".tbx,.xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </>
  )
}

/**
 * XLIFF Export button — generates XLIFF from job segments.
 */
export function XliffExportButton({ jobId, jobRef, sourceLang, targetLang, contentType }: {
  jobId: string; jobRef: string; sourceLang: string; targetLang: string; contentType?: string
}) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const { data: segments } = await supabase.from('job_segments')
        .select('segment_index, source_text, ai_translation, reviewer_translation, severity')
        .eq('job_id', jobId).order('segment_index')

      if (!segments?.length) { alert('No segments to export'); return }

      const xliff = generateXliff({
        jobRef,
        sourceLang,
        targetLang,
        contentType,
        segments: segments.map(s => ({
          id: `s${s.segment_index}`,
          source: s.source_text,
          target: s.reviewer_translation ?? s.ai_translation,
          state: s.reviewer_translation ? 'final' : 'translated',
          note: s.severity ? `Severity: ${s.severity}` : undefined,
        })),
      })
      downloadFile(xliff, `${jobRef}-verified.xliff`)
    } finally { setLoading(false) }
  }

  return (
    <button onClick={handleExport} disabled={loading} className="text-xs border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
      <Download className="w-3 h-3" /> {loading ? 'Generating...' : 'Export XLIFF'}
    </button>
  )
}
