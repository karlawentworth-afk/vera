import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useClientOrgId } from '../../lib/useClientOrg'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Upload, X } from 'lucide-react'

import { AI_TOOLS, LANGUAGES, CONTENT_TYPES } from '../../lib/constants'

const COLORS = { purple: '#8E2882', orange: '#EE7C24' }
const ACCEPTED_TYPES = ['.docx', '.xliff', '.txt', '.csv', '.pdf']

function extractWordCountFromText(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function ClientSubmit() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const orgId = useClientOrgId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [wordCount, setWordCount] = useState<number | null>(null)
  const [wordCountManual, setWordCountManual] = useState('')
  const [sourceLang, setSourceLang] = useState('EN')
  const [targetLang, setTargetLang] = useState('DE')
  const [contentType, setContentType] = useState(CONTENT_TYPES[0])
  const [aiTool, setAiTool] = useState(AI_TOOLS[0])
  const [urgency, setUrgency] = useState<'standard' | 'expedited'>('standard')
  const [notes, setNotes] = useState('')
  const [showOverflowModal, setShowOverflowModal] = useState(false)
  const [overflowWords, setOverflowWords] = useState(0)

  const { data: org } = useQuery({
    queryKey: ['submit-org', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('organisations').select('name').eq('id', orgId!).single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: subscription } = useQuery({
    queryKey: ['submit-subscription', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('organisation_id', orgId!).eq('status', 'active').single()
      if (error) throw error
      return data
    },
    enabled: !!orgId,
  })

  const { data: usedWords } = useQuery({
    queryKey: ['submit-usage', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('word_count')
        .eq('organisation_id', orgId!)
        .neq('status', 'cancelled')
      if (error) throw error
      return data.reduce((sum: number, j: { word_count: number }) => sum + j.word_count, 0) as number
    },
    enabled: !!orgId,
  })

  const effectiveWordCount = wordCount ?? (wordCountManual ? parseInt(wordCountManual) : 0)
  const allowance = subscription?.word_allowance ?? null
  const remaining = allowance !== null ? allowance - (usedWords ?? 0) : null
  const wouldExceed = remaining !== null && effectiveWordCount > remaining

  const handleFileDrop = useCallback(async (f: File) => {
    setFile(f)
    const name = f.name.toLowerCase()

    if (name.endsWith('.txt') || name.endsWith('.csv')) {
      const text = await f.text()
      setWordCount(extractWordCountFromText(text))
    } else if (name.endsWith('.docx')) {
      // Basic docx word count: extract text from XML
      try {
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(f)
        const docXml = await zip.file('word/document.xml')?.async('string')
        if (docXml) {
          const textContent = docXml.replace(/<[^>]+>/g, ' ')
          setWordCount(extractWordCountFromText(textContent))
        }
      } catch {
        // Fallback to manual
        setWordCount(null)
      }
    } else {
      // PDF, XLIFF — require manual input
      setWordCount(null)
    }
  }, [])

  const submitMutation = useMutation({
    mutationFn: async () => {
      const wc = effectiveWordCount
      if (!wc || wc <= 0) throw new Error('Word count required')
      if (!orgId) throw new Error('No organisation')

      const dueHours = urgency === 'expedited' ? 6 : 24
      const dueAt = new Date()
      dueAt.setHours(dueAt.getHours() + dueHours)

      // Create job
      const { data: job, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          job_number: '',
          organisation_id: orgId,
          source_language: sourceLang,
          target_language: targetLang,
          content_type: contentType,
          ai_tool_used: aiTool,
          word_count: wc,
          urgency,
          status: 'unallocated',
          notes: notes || null,
          submitted_at: new Date().toISOString(),
          due_at: dueAt.toISOString(),
        })
        .select('id')
        .single()
      if (jobErr) throw jobErr

      // Upload file if present
      if (file) {
        const path = `${orgId}/${job.id}/source/${file.name}`
        const { error: uploadErr } = await supabase.storage
          .from('job-files')
          .upload(path, file)
        if (uploadErr) {
          console.error('File upload failed:', uploadErr.message)
          // Don't block job creation on upload failure
        }
      }

      // Audit log
      await supabase.from('audit_log').insert({
        actor_id: profile!.id,
        action: 'submitted_job',
        entity_type: 'job',
        entity_id: job.id,
        details: { word_count: wc, urgency, content_type: contentType, overflow: wouldExceed },
      })

      return job.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['submit-usage'] })
      navigate('/client/jobs')
    },
  })

  function handleSubmit() {
    if (wouldExceed) {
      setOverflowWords(effectiveWordCount - (remaining ?? 0))
      setShowOverflowModal(true)
    } else {
      submitMutation.mutate()
    }
  }

  const valid = effectiveWordCount > 0 && sourceLang !== targetLang && orgId

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">Client portal</p>
        <h1 className="text-2xl font-light text-gray-900 mt-1">{org?.name}</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main form */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <RainbowStripe height={3} />
          <div className="p-6">
            <h3 className="font-medium text-gray-900 mb-1">Submit AI-translated content for review</h3>
            <p className="text-sm text-gray-500 mb-6">Upload your content. We'll check, score and certify it.</p>

            {/* File upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
              onDrop={e => {
                e.preventDefault()
                e.stopPropagation()
                const f = e.dataTransfer.files[0]
                if (f) handleFileDrop(f)
              }}
              className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center mb-6 hover:border-gray-300 transition cursor-pointer"
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{file.name}</span>
                  <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(0)} KB)</span>
                  <button onClick={e => { e.stopPropagation(); setFile(null); setWordCount(null) }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900">Drop files here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Supports {ACCEPTED_TYPES.join(', ')} · Max 20MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFileDrop(f)
              }}
            />

            {/* Word count */}
            {file && wordCount !== null && (
              <div className="mb-6 bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">Detected word count</span>
                <span className="text-sm font-medium text-gray-900">{wordCount.toLocaleString()} words</span>
              </div>
            )}
            {file && wordCount === null && (
              <div className="mb-6">
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Word count (enter manually for this file type)</label>
                <input
                  type="number"
                  min="1"
                  value={wordCountManual}
                  onChange={e => setWordCountManual(e.target.value)}
                  placeholder="e.g. 4500"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            )}
            {!file && (
              <div className="mb-6">
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Word count</label>
                <input
                  type="number"
                  min="1"
                  value={wordCountManual}
                  onChange={e => setWordCountManual(e.target.value)}
                  placeholder="e.g. 4500"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
            )}

            {/* Language pair */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Source language</label>
                <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-sm">
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Target language</label>
                <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-sm">
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">Content type</label>
                <select value={contentType} onChange={e => setContentType(e.target.value)} className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-sm">
                  {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500 font-medium">AI tool used</label>
                <select value={aiTool} onChange={e => setAiTool(e.target.value)} className="mt-1 w-full border border-gray-200 rounded px-3 py-2 text-sm">
                  {AI_TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Urgency */}
            <div className="mb-6">
              <label className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2 block">Turnaround</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUrgency('standard')}
                  className={`text-left border-2 rounded-lg p-4 cursor-pointer transition ${urgency === 'standard' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">Standard</span>
                    <span className="text-xs text-gray-500">Included</span>
                  </div>
                  <p className="text-xs text-gray-500">24h SLA · Counts toward monthly allowance</p>
                </button>
                <button
                  type="button"
                  onClick={() => setUrgency('expedited')}
                  className={`text-left border-2 rounded-lg p-4 cursor-pointer transition ${urgency === 'expedited' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">Expedited</span>
                    <span className="text-xs font-medium" style={{ color: COLORS.orange }}>+50%</span>
                  </div>
                  <p className="text-xs text-gray-500">6h SLA · Priority queue · Premium rate</p>
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2 block">Notes for the reviewer (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Brand voice notes, specific terminology, target audience..."
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-gray-400"
              />
            </div>

            {submitMutation.isError && (
              <p className="mb-4 text-sm text-red-600">{(submitMutation.error as Error).message}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!valid || submitMutation.isPending}
              className="w-full bg-gray-900 text-white rounded-lg py-3 font-medium text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit for review'}
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {subscription && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Your subscription</p>
              <p className="text-lg font-medium text-gray-900">{subscription.tier_name} tier</p>
              <p className="text-xs text-gray-500 mt-1">{allowance ? `${allowance.toLocaleString()} words included monthly` : 'Unlimited (fair-use)'}</p>
              {allowance && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Used this month</span>
                    <span className="font-medium">{(usedWords ?? 0).toLocaleString()} words</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Remaining</span>
                    <span className="font-medium">{Math.max(0, remaining ?? 0).toLocaleString()} words</span>
                  </div>
                  <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(((usedWords ?? 0) / allowance) * 100, 100)}%`,
                        background: ((usedWords ?? 0) / allowance) > 0.9 ? COLORS.orange : COLORS.purple,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">What happens next</p>
            <div className="space-y-3 text-xs text-gray-600">
              {[
                'Your file is logged and an expert reviewer is assigned within 30 minutes.',
                'Native linguist reviews against accuracy, terminology, tone, brand and cultural fit.',
                'You receive the verified file with audit trail and hTER score.',
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium shrink-0">{i + 1}</div>
                  <div>{step}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Overflow modal */}
      {showOverflowModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowOverflowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-base font-medium text-gray-900 mb-2">Allowance exceeded</h3>
              <p className="text-sm text-gray-500 mb-4">
                This submission of {effectiveWordCount.toLocaleString()} words exceeds your remaining allowance by <span className="font-medium text-gray-900">{overflowWords.toLocaleString()} words</span>.
              </p>
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => { setShowOverflowModal(false); submitMutation.mutate() }}
                  className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition"
                >
                  <p className="text-sm font-medium text-gray-900">Pay overflow rate</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {overflowWords.toLocaleString()} words × £{((subscription?.overflow_rate_pence ?? 8) / 100).toFixed(2)}/word = £{((overflowWords * (subscription?.overflow_rate_pence ?? 8)) / 100).toFixed(2)}
                  </p>
                </button>
                <button className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition opacity-60">
                  <p className="text-sm font-medium text-gray-900">Upgrade for one month</p>
                  <p className="text-xs text-gray-500 mt-0.5">Coming soon — contact your account team</p>
                </button>
                <button className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition opacity-60">
                  <p className="text-sm font-medium text-gray-900">Upgrade permanently</p>
                  <p className="text-xs text-gray-500 mt-0.5">Coming soon — contact your account team</p>
                </button>
              </div>
              <button onClick={() => setShowOverflowModal(false)} className="w-full text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
