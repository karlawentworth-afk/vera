import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { useAuth } from '../../lib/auth'
import { useClientOrgId } from '../../lib/useClientOrg'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { LANGUAGES } from '../../lib/constants'
import { Plus, Trash2, Save } from 'lucide-react'
import { TbxExportButton, TbxImportButton } from '../../components/shared/TranslationExports'

export function ClientGlossary() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const orgId = useClientOrgId()
  const [search, setSearch] = useState('')
  const [langFilter, setLangFilter] = useState('')
  const [newTerm, setNewTerm] = useState({ source_term: '', target_language: 'DE', preferred_translation: '', do_not_translate: false, notes: '' })

  // Glossary entries
  const { data: entries, isLoading } = useQuery({
    queryKey: ['glossary', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glossary_entries')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('is_demo', getIsDemo())
        .order('source_term')
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  // Brand voice
  const { data: brandVoice } = useQuery({
    queryKey: ['brand-voice', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_voice_notes')
        .select('*')
        .eq('organisation_id', orgId!)
        .eq('is_demo', getIsDemo())
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const [guidelines, setGuidelines] = useState('')
  const [toneInput, setToneInput] = useState('')
  const [tones, setTones] = useState<string[]>([])
  const [forbiddenInput, setForbiddenInput] = useState('')
  const [forbidden, setForbidden] = useState<string[]>([])
  const [brandInited, setBrandInited] = useState(false)

  // Init brand voice form when data loads
  if (brandVoice && !brandInited) {
    setGuidelines(brandVoice.guidelines ?? '')
    setTones(brandVoice.tone_descriptors ?? [])
    setForbidden(brandVoice.forbidden_phrases ?? [])
    setBrandInited(true)
  }

  const addEntryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('glossary_entries').insert({
        organisation_id: orgId!,
        ...newTerm,
      })
      if (error) throw error
      await supabase.from('audit_log').insert({ actor_id: profile!.id, action: 'glossary_entry_added', entity_type: 'glossary', entity_id: orgId!, details: { term: newTerm.source_term } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['glossary', orgId] })
      setNewTerm({ source_term: '', target_language: 'DE', preferred_translation: '', do_not_translate: false, notes: '' })
    },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('glossary_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['glossary', orgId] }),
  })

  const saveBrandMutation = useMutation({
    mutationFn: async () => {
      if (brandVoice) {
        const { error } = await supabase.from('brand_voice_notes').update({
          guidelines, tone_descriptors: tones, forbidden_phrases: forbidden,
        }).eq('id', brandVoice.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('brand_voice_notes').insert({
          organisation_id: orgId!, guidelines, tone_descriptors: tones, forbidden_phrases: forbidden,
        })
        if (error) throw error
      }
      await supabase.from('audit_log').insert({ actor_id: profile!.id, action: 'brand_voice_updated', entity_type: 'brand_voice', entity_id: orgId!, details: {} })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-voice', orgId] })
    },
  })

  const filtered = entries?.filter(e => {
    if (langFilter && e.target_language !== langFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return e.source_term.toLowerCase().includes(q) || e.preferred_translation.toLowerCase().includes(q)
    }
    return true
  }) ?? []

  const usedLangs = [...new Set(entries?.map(e => e.target_language) ?? [])]

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Glossary & brand voice</p>
        <h1 className="text-xl sm:text-2xl font-light text-gray-900 mt-1">Terminology & style guide</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Glossary */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-4 sm:p-6">
              <h3 className="font-medium text-gray-900 mb-4">Terminology</h3>

              {/* Filters */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <input type="text" placeholder="Search terms..." value={search} onChange={e => setSearch(e.target.value)} className="text-sm border border-gray-200 rounded px-3 py-1.5 flex-1 min-w-[150px] focus:outline-none focus:border-gray-400" />
                <select value={langFilter} onChange={e => setLangFilter(e.target.value)} className="text-sm border border-gray-200 rounded px-3 py-1.5">
                  <option value="">All languages</option>
                  {usedLangs.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Add new */}
              <div className="grid grid-cols-12 gap-2 mb-4 items-end">
                <input type="text" placeholder="Source term" value={newTerm.source_term} onChange={e => setNewTerm(p => ({ ...p, source_term: e.target.value }))} className="col-span-3 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400" />
                <select value={newTerm.target_language} onChange={e => setNewTerm(p => ({ ...p, target_language: e.target.value }))} className="col-span-2 text-sm border border-gray-200 rounded px-2 py-1.5">
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <input type="text" placeholder="Preferred translation" value={newTerm.preferred_translation} onChange={e => setNewTerm(p => ({ ...p, preferred_translation: e.target.value }))} className="col-span-3 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400" />
                <input type="text" placeholder="Notes" value={newTerm.notes} onChange={e => setNewTerm(p => ({ ...p, notes: e.target.value }))} className="col-span-3 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400" />
                <button onClick={() => addEntryMutation.mutate()} disabled={!newTerm.source_term || !newTerm.preferred_translation || addEntryMutation.isPending} className="col-span-1 bg-gray-900 text-white rounded py-1.5 disabled:opacity-50 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Entries */}
              <div className="space-y-1">
                {filtered.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No glossary entries yet. Add your first term above.</p>}
                {filtered.map(e => (
                  <div key={e.id} className="grid grid-cols-12 gap-2 py-2 border-b border-gray-50 items-center text-sm">
                    <span className="col-span-3 font-medium text-gray-900">{e.source_term}</span>
                    <span className="col-span-2 text-gray-500">{e.target_language}</span>
                    <span className="col-span-3 text-gray-700">{e.preferred_translation}</span>
                    <span className="col-span-3 text-xs text-gray-500">{e.notes || '—'}</span>
                    <button onClick={() => deleteEntryMutation.mutate(e.id)} className="col-span-1 text-gray-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <p className="text-xs text-gray-400 flex-1">{entries?.length ?? 0} terms total</p>
                <TbxExportButton orgId={orgId!} orgName="Client" />
                <TbxImportButton orgId={orgId!} onImported={() => queryClient.invalidateQueries({ queryKey: ['glossary'] })} />
              </div>
            </div>
          </div>

          {/* Brand voice */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-4 sm:p-6">
              <h3 className="font-medium text-gray-900 mb-4">Brand voice</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Guidelines</label>
                  <textarea value={guidelines} onChange={e => setGuidelines(e.target.value)} placeholder="Describe your brand's voice and tone..." className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-28 focus:outline-none focus:border-gray-400" />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Tone descriptors</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tones.map((t, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1 flex items-center gap-1">
                        {t} <button onClick={() => setTones(tones.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600">&times;</button>
                      </span>
                    ))}
                  </div>
                  <input type="text" value={toneInput} onChange={e => setToneInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && toneInput.trim()) { setTones([...tones, toneInput.trim()]); setToneInput('') } }} placeholder="Type and press Enter (e.g. professional, warm)" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Forbidden phrases</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {forbidden.map((f, i) => (
                      <span key={i} className="text-xs bg-red-50 text-red-700 rounded px-2 py-1 flex items-center gap-1">
                        {f} <button onClick={() => setForbidden(forbidden.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">&times;</button>
                      </span>
                    ))}
                  </div>
                  <input type="text" value={forbiddenInput} onChange={e => setForbiddenInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && forbiddenInput.trim()) { setForbidden([...forbidden, forbiddenInput.trim()]); setForbiddenInput('') } }} placeholder="Type and press Enter" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                </div>

                <div className="flex items-center justify-end gap-2">
                  {saveBrandMutation.isSuccess && <span className="text-xs text-green-600">Saved</span>}
                  <button onClick={() => saveBrandMutation.mutate()} disabled={saveBrandMutation.isPending} className="text-sm bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1">
                    <Save className="w-3.5 h-3.5" /> {saveBrandMutation.isPending ? 'Saving...' : 'Save brand voice'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 h-fit">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Why this matters</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Your glossary is used by Vera's AI pre-flight check and human reviewers to maintain consistency across all your AI translations. The more you add, the better your AI Health Score becomes.
          </p>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-500">
            <p><span className="font-medium text-gray-700">{entries?.length ?? 0}</span> glossary terms</p>
            <p><span className="font-medium text-gray-700">{tones.length}</span> tone descriptors</p>
            <p><span className="font-medium text-gray-700">{forbidden.length}</span> forbidden phrases</p>
          </div>
        </div>
      </div>
    </div>
  )
}
