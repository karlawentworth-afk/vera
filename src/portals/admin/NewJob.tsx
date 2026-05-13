import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { AI_TOOLS, LANGUAGES, CONTENT_TYPES } from '../../lib/constants'

interface NewJobProps {
  onClose: () => void
  onCreated: (jobId: string) => void
}

export function NewJob({ onClose, onCreated }: NewJobProps) {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  const [orgId, setOrgId] = useState('')
  const [sourceLang, setSourceLang] = useState('EN')
  const [targetLang, setTargetLang] = useState('DE')
  const [contentType, setContentType] = useState(CONTENT_TYPES[0])
  const [aiTool, setAiTool] = useState(AI_TOOLS[0])
  const [wordCount, setWordCount] = useState('')
  const [urgency, setUrgency] = useState<'standard' | 'expedited'>('standard')
  const [notes, setNotes] = useState('')

  const { data: clientOrgs } = useQuery({
    queryKey: ['client-orgs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('id, name')
        .eq('type', 'client')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const dueHours = urgency === 'expedited' ? 6 : 24
      const dueAt = new Date()
      dueAt.setHours(dueAt.getHours() + dueHours)

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          job_number: '',
          organisation_id: orgId,
          source_language: sourceLang,
          target_language: targetLang,
          content_type: contentType,
          ai_tool_used: aiTool,
          word_count: parseInt(wordCount),
          urgency,
          status: 'unallocated',
          notes: notes || null,
          submitted_at: new Date().toISOString(),
          due_at: dueAt.toISOString(),
        })
        .select('id')
        .single()
      if (error) throw error

      await supabase.from('audit_log').insert({
        actor_id: profile!.id,
        action: 'created',
        entity_type: 'job',
        entity_id: data.id,
        details: { organisation_id: orgId, word_count: parseInt(wordCount) },
      })

      return data.id as string
    },
    onSuccess: (jobId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] })
      onCreated(jobId)
    },
  })

  const valid = orgId && sourceLang && targetLang && sourceLang !== targetLang && parseInt(wordCount) > 0

  return (
    <div className="space-y-6">
      <RainbowStripe height={2} />

      {/* Client */}
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Client organisation</label>
        <select
          value={orgId}
          onChange={e => setOrgId(e.target.value)}
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
        >
          <option value="">Select client...</option>
          {clientOrgs?.map(org => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </div>

      {/* Language pair */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Source language</label>
          <select
            value={sourceLang}
            onChange={e => setSourceLang(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Target language</label>
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Content type + AI tool */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Content type</label>
          <select
            value={contentType}
            onChange={e => setContentType(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          >
            {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">AI tool used</label>
          <select
            value={aiTool}
            onChange={e => setAiTool(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          >
            {AI_TOOLS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Word count */}
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Word count</label>
        <input
          type="number"
          min="1"
          value={wordCount}
          onChange={e => setWordCount(e.target.value)}
          placeholder="e.g. 4500"
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
        />
      </div>

      {/* Urgency */}
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Turnaround</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setUrgency('standard')}
            className={`text-left rounded-lg p-4 border-2 transition ${urgency === 'standard' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">Standard</span>
              <span className="text-xs text-gray-500">24h SLA</span>
            </div>
            <p className="text-xs text-gray-500">Normal queue priority</p>
          </button>
          <button
            type="button"
            onClick={() => setUrgency('expedited')}
            className={`text-left rounded-lg p-4 border-2 transition ${urgency === 'expedited' ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">Expedited</span>
              <span className="text-xs font-medium" style={{ color: '#EE7C24' }}>+50%</span>
            </div>
            <p className="text-xs text-gray-500">6h SLA · Priority queue</p>
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Brand voice notes, specific terminology, target audience..."
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-gray-400"
        />
      </div>

      {/* Actions */}
      {createMutation.isError && (
        <p className="text-sm text-red-600">Failed to create job. Please try again.</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!valid || createMutation.isPending}
          className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating...' : 'Create job'}
        </button>
      </div>
    </div>
  )
}
