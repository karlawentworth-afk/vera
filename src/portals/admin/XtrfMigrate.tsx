import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Upload, CheckCircle, AlertTriangle, FileText } from 'lucide-react'

type ImportType = 'clients' | 'reviewers' | 'projects' | 'glossary'

const IMPORT_TYPES: { value: ImportType; label: string; desc: string; fields: string[] }[] = [
  { value: 'clients', label: 'Clients', desc: 'Import client organisations with contacts', fields: ['company_name', 'contact_name', 'contact_email', 'industry'] },
  { value: 'reviewers', label: 'Vendors (Reviewers)', desc: 'Import freelance linguists', fields: ['name', 'email', 'languages', 'specialism', 'rate'] },
  { value: 'projects', label: 'Projects (Historical)', desc: 'Import as completed jobs (metadata only, no scoring)', fields: ['reference', 'client', 'source_lang', 'target_lang', 'word_count', 'date', 'content_type'] },
  { value: 'glossary', label: 'Glossaries', desc: 'Import terminology entries', fields: ['source_term', 'target_language', 'translation', 'client'] },
]

export function AdminXtrfMigrate() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importType, setImportType] = useState<ImportType>('clients')
  const [csvData, setCsvData] = useState<string[][] | null>(null)
  const [fileName, setFileName] = useState('')
  const [columnMap, setColumnMap] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState(false)

  const typeConfig = IMPORT_TYPES.find(t => t.value === importType)!

  const { data: importHistory } = useQuery({
    queryKey: ['import-log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('import_log').select('*').order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data
    },
  })

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = text.split('\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
      setCsvData(rows)
      // Auto-map columns
      const headers = rows[0]
      const map: Record<string, number> = {}
      typeConfig.fields.forEach(field => {
        const idx = headers.findIndex(h => h.toLowerCase().includes(field.replace('_', ' ').toLowerCase()) || h.toLowerCase().includes(field.toLowerCase()))
        if (idx >= 0) map[field] = idx
      })
      setColumnMap(map)
      setPreview(true)
    }
    reader.readAsText(file)
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!csvData || csvData.length < 2) throw new Error('No data')

      const rows = csvData.slice(1).filter(r => r.length > 1 && r.some(c => c.trim()))
      let imported = 0
      let skipped = 0
      const errors: string[] = []

      for (const row of rows) {
        try {
          const get = (field: string) => columnMap[field] !== undefined ? row[columnMap[field]]?.trim() : ''

          if (importType === 'clients') {
            const name = get('company_name')
            if (!name) { skipped++; continue }
            await supabase.from('organisations').insert({ name, type: 'client', imported_from_xtrf: true })
            imported++
          } else if (importType === 'reviewers') {
            const name = get('name')
            const email = get('email')
            if (!name || !email) { skipped++; continue }
            // Just create profile record (no auth user — admin can invite separately)
            await supabase.from('profiles').insert({
              id: crypto.randomUUID(), email, full_name: name, role: 'reviewer',
              languages: get('languages')?.split(';').map(l => l.trim()).filter(Boolean) || [],
              specialism: get('specialism') || null,
              rate_per_word: get('rate') ? parseFloat(get('rate')) : null,
              imported_from_xtrf: true,
            })
            imported++
          } else if (importType === 'projects') {
            const client = get('client')
            const { data: org } = await supabase.from('organisations').select('id').eq('name', client).maybeSingle()
            if (!org) { errors.push(`Client not found: ${client}`); skipped++; continue }
            await supabase.from('jobs').insert({
              job_number: get('reference') || '', organisation_id: org.id,
              source_language: get('source_lang') || 'EN', target_language: get('target_lang') || 'DE',
              content_type: get('content_type') || 'Imported from XTRF',
              word_count: parseInt(get('word_count')) || 0,
              status: 'delivered', submitted_at: get('date') || new Date().toISOString(),
              due_at: get('date') || new Date().toISOString(),
              delivered_at: get('date') || new Date().toISOString(),
              imported_from_xtrf: true,
            })
            imported++
          } else if (importType === 'glossary') {
            const client = get('client')
            const { data: org } = await supabase.from('organisations').select('id').eq('name', client).maybeSingle()
            if (!org) { errors.push(`Client not found: ${client}`); skipped++; continue }
            await supabase.from('glossary_entries').insert({
              organisation_id: org.id, source_term: get('source_term'),
              target_language: get('target_language') || 'DE',
              preferred_translation: get('translation'),
              imported_from_xtrf: true,
            })
            imported++
          }
        } catch (err) {
          errors.push(String(err))
          skipped++
        }
      }

      // Log import
      await supabase.from('import_log').insert({
        import_type: importType, filename: fileName,
        records_imported: imported, records_skipped: skipped,
        errors, imported_by: profile!.id,
      })

      await supabase.from('audit_log').insert({
        actor_id: profile!.id, action: 'xtrf_import', entity_type: 'import',
        entity_id: importType, details: { filename: fileName, imported, skipped, errors: errors.length },
      })

      return { imported, skipped, errors }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-log'] })
      setCsvData(null)
      setPreview(false)
    },
  })

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={4} />
        <div className="p-6">
          <h2 className="text-lg font-light text-gray-900 mb-1">Migrate from XTRF</h2>
          <p className="text-sm text-gray-500 mb-6">Upload XTRF exports (CSV) to bulk import data into Vera. Records are marked as imported for traceability.</p>

          {/* Import type selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {IMPORT_TYPES.map(t => (
              <button key={t.value} onClick={() => { setImportType(t.value); setCsvData(null); setPreview(false) }}
                className={`text-left p-3 rounded-lg border transition ${importType === t.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <p className="text-sm font-medium text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Expected columns */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 mb-1">Expected CSV columns for {typeConfig.label}:</p>
            <p className="text-xs font-mono text-gray-700">{typeConfig.fields.join(', ')}</p>
          </div>

          {/* Upload */}
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-gray-300 transition">
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">{fileName || 'Click to upload CSV file'}</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {/* Preview & column mapping */}
          {preview && csvData && (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium text-gray-900">Column mapping</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {typeConfig.fields.map(field => (
                  <div key={field}>
                    <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">{field}</label>
                    <select value={columnMap[field] ?? ''} onChange={e => setColumnMap(prev => ({ ...prev, [field]: parseInt(e.target.value) }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm">
                      <option value="">— unmapped —</option>
                      {csvData[0].map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>{csvData[0].map((h, i) => <th key={i} className="text-left py-1 px-2 font-medium text-gray-500">{h}</th>)}</tr></thead>
                  <tbody>{csvData.slice(1, 6).map((row, i) => <tr key={i} className="border-t border-gray-50">{row.map((c, j) => <td key={j} className="py-1 px-2 text-gray-700">{c}</td>)}</tr>)}</tbody>
                </table>
                {csvData.length > 6 && <p className="text-xs text-gray-400 p-2">...and {csvData.length - 6} more rows</p>}
              </div>

              {importMutation.data && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800">Imported {importMutation.data.imported}, skipped {importMutation.data.skipped}</span>
                </div>
              )}
              {importMutation.isError && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-800">{(importMutation.error as Error).message}</span>
                </div>
              )}

              <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending}
                className="bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                {importMutation.isPending ? `Importing ${csvData.length - 1} rows...` : `Import ${csvData.length - 1} ${typeConfig.label.toLowerCase()}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Import history */}
      {importHistory && importHistory.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-4">Import history</h3>
            <div className="space-y-2">
              {importHistory.map(log => (
                <div key={log.id} className="flex items-center justify-between p-2 border border-gray-100 rounded text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{log.filename}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{log.import_type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="text-green-600">{log.records_imported} imported</span>
                    {log.records_skipped > 0 && <span className="text-orange-600">{log.records_skipped} skipped</span>}
                    <span>{new Date(log.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
