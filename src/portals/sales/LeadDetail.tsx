import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { ArrowLeft, Phone, Mail, MessageSquare, Calendar, Send } from 'lucide-react'

const STAGES = ['new', 'contacted', 'qualified', 'demo_booked', 'proposal_sent', 'negotiating', 'won', 'lost'] as const
const STAGE_LABELS: Record<string, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', demo_booked: 'Demo booked', proposal_sent: 'Proposal sent', negotiating: 'Negotiating', won: 'Won', lost: 'Lost' }
const STAGE_COLORS: Record<string, string> = { new: '#1FA1D6', contacted: '#1B4F9E', qualified: '#8E2882', demo_booked: '#E5187A', proposal_sent: '#EE7C24', negotiating: '#F4D31E', won: '#0F8F4D', lost: '#D9211E' }

export function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [newNote, setNewNote] = useState('')
  const [activityType, setActivityType] = useState('call')
  const [activitySummary, setActivitySummary] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [showLostModal, setShowLostModal] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const backUrl = isAdmin ? '/admin/leads' : '/sales/leads'

  const { data: lead } = useQuery({
    queryKey: ['lead-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id!).eq('is_demo', getIsDemo()).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: notes } = useQuery({
    queryKey: ['lead-notes', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_notes').select('*, author:profiles!lead_notes_author_id_fkey(full_name)').eq('lead_id', id!).eq('is_demo', getIsDemo()).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: activities } = useQuery({
    queryKey: ['lead-activities', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_activities').select('*').eq('lead_id', id!).eq('is_demo', getIsDemo()).order('occurred_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const stageChangeMutation = useMutation({
    mutationFn: async (newStage: string) => {
      await supabase.from('leads').update({ stage: newStage }).eq('id', id!)
      await supabase.from('lead_activities').insert({ lead_id: id!, type: 'stage_change', summary: `Stage changed to ${STAGE_LABELS[newStage]}`, created_by: profile!.id })
      await supabase.from('audit_log').insert({ actor_id: profile!.id, action: 'lead_stage_changed', entity_type: 'lead', entity_id: id!, details: { new_stage: newStage } })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['lead-detail', id] }); queryClient.invalidateQueries({ queryKey: ['lead-activities', id] }) },
  })

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('lead_notes').insert({ lead_id: id!, author_id: profile!.id, body: newNote })
      await supabase.from('lead_activities').insert({ lead_id: id!, type: 'note', summary: newNote.substring(0, 100), created_by: profile!.id })
    },
    onSuccess: () => { setNewNote(''); queryClient.invalidateQueries({ queryKey: ['lead-notes', id] }); queryClient.invalidateQueries({ queryKey: ['lead-activities', id] }) },
  })

  const logActivityMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('lead_activities').insert({ lead_id: id!, type: activityType, summary: activitySummary, created_by: profile!.id })
    },
    onSuccess: () => { setActivitySummary(''); queryClient.invalidateQueries({ queryKey: ['lead-activities', id] }) },
  })

  const markLostMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('leads').update({ stage: 'lost', lost_reason: lostReason }).eq('id', id!)
      await supabase.from('lead_activities').insert({ lead_id: id!, type: 'stage_change', summary: `Marked as lost: ${lostReason}`, created_by: profile!.id })
    },
    onSuccess: () => { setShowLostModal(false); queryClient.invalidateQueries({ queryKey: ['lead-detail', id] }) },
  })

  if (!lead) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  const stageColor = STAGE_COLORS[lead.stage] ?? '#6B7280'

  return (
    <div className="space-y-6">
      <Link to={backUrl} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to leads
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="h-1" style={{ background: stageColor }} />
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-gray-400">{lead.reference}</span>
              <h1 className="text-lg font-medium text-gray-900 mt-1">{lead.contact_name}</h1>
              {lead.job_title && <p className="text-sm text-gray-500">{lead.job_title}</p>}
              <p className="text-sm text-gray-700 mt-1">{lead.company_name}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                {lead.contact_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.contact_email}</span>}
                {lead.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.contact_phone}</span>}
              </div>
            </div>
            {lead.estimated_value_pence && (
              <div className="text-right">
                <p className="text-2xl font-light text-gray-900">£{(lead.estimated_value_pence / 100).toLocaleString()}</p>
                <p className="text-xs text-gray-500">Est. MRR</p>
              </div>
            )}
          </div>

          {/* Stage selector */}
          <div className="mt-4 flex gap-1 flex-wrap">
            {STAGES.map(s => (
              <button key={s} onClick={() => s !== 'lost' && stageChangeMutation.mutate(s)}
                className={`text-[10px] px-2 py-1 rounded transition ${lead.stage === s ? 'ring-2 ring-offset-1' : 'opacity-50 hover:opacity-100'}`}
                style={{ background: STAGE_COLORS[s] + '20', color: STAGE_COLORS[s] }}
                disabled={s === 'lost'}
              >{STAGE_LABELS[s]}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-6">
          {/* Add note */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-16 focus:outline-none focus:border-gray-400 mb-2" />
            <button onClick={() => addNoteMutation.mutate()} disabled={!newNote || addNoteMutation.isPending} className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Add note
            </button>
          </div>

          {/* Log activity */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex gap-2 items-end">
              <select value={activityType} onChange={e => setActivityType(e.target.value)} className="text-sm border border-gray-200 rounded px-2 py-1.5">
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
              </select>
              <input type="text" value={activitySummary} onChange={e => setActivitySummary(e.target.value)} placeholder="Summary..." className="flex-1 border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400" />
              <button onClick={() => logActivityMutation.mutate()} disabled={!activitySummary || logActivityMutation.isPending} className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50">Log</button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="p-6">
              <h3 className="font-medium text-gray-900 mb-4">Timeline</h3>
              <div className="space-y-3">
                {activities?.map(a => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      {a.type === 'call' ? <Phone className="w-3 h-3 text-gray-400" /> : a.type === 'email' ? <Mail className="w-3 h-3 text-gray-400" /> : a.type === 'meeting' ? <Calendar className="w-3 h-3 text-gray-400" /> : <MessageSquare className="w-3 h-3 text-gray-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-700">{a.summary}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(a.occurred_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {a.type}</p>
                    </div>
                  </div>
                ))}
                {(!activities || activities.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>}
              </div>
            </div>
          </div>

          {/* Notes */}
          {notes && notes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-900 mb-4">Notes</h3>
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="border-l-2 border-gray-200 pl-3 py-1">
                    <p className="text-sm text-gray-700">{n.body}</p>
                    <p className="text-xs text-gray-400 mt-1">{(n.author as { full_name: string })?.full_name} · {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-3">Details</p>
            <div className="space-y-2 text-sm">
              {lead.industry && <div className="flex justify-between"><span className="text-gray-500">Industry</span><span>{lead.industry}</span></div>}
              {lead.company_size && <div className="flex justify-between"><span className="text-gray-500">Size</span><span>{lead.company_size}</span></div>}
              {lead.source && <div className="flex justify-between"><span className="text-gray-500">Source</span><span>{lead.source}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>
            </div>
          </div>

          {lead.next_action && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-2">Next action</p>
              <p className="text-sm text-gray-900">{lead.next_action}</p>
              {lead.next_action_date && <p className="text-xs text-gray-500 mt-1">{new Date(lead.next_action_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
            </div>
          )}

          {lead.stage !== 'won' && lead.stage !== 'lost' && (
            <div className="space-y-2">
              {['qualified', 'demo_booked', 'proposal_sent', 'negotiating'].includes(lead.stage) && (
                <Link to={`/admin/quotes`} className="w-full text-sm border border-gray-200 rounded-lg py-2 hover:bg-gray-50 flex items-center justify-center gap-1">
                  <Send className="w-3 h-3" /> Convert to quote
                </Link>
              )}
              <button onClick={() => setShowLostModal(true)} className="w-full text-sm border border-red-200 text-red-600 rounded-lg py-2 hover:bg-red-50">Mark as lost</button>
            </div>
          )}

          {lead.stage === 'lost' && lead.lost_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">
              <p className="text-xs text-red-600 font-medium mb-1">Lost reason</p>
              <p className="text-sm text-red-800">{lead.lost_reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lost modal */}
      {showLostModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowLostModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
              <h3 className="font-medium text-gray-900 mb-2">Mark as lost</h3>
              <textarea value={lostReason} onChange={e => setLostReason(e.target.value)} placeholder="Why was this lead lost?" className="w-full border border-gray-200 rounded px-3 py-2 text-sm h-20 focus:outline-none focus:border-gray-400 mb-3" />
              <div className="flex gap-2">
                <button onClick={() => setShowLostModal(false)} className="flex-1 border border-gray-200 rounded py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={() => markLostMutation.mutate()} disabled={!lostReason || markLostMutation.isPending} className="flex-1 bg-red-600 text-white rounded py-2 text-sm hover:bg-red-700 disabled:opacity-50">Confirm</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
