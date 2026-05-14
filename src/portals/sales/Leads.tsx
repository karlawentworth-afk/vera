import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Drawer } from '../../components/shared/Drawer'
import { MetricCard } from '../../components/shared/MetricCard'
import { Plus, List, LayoutGrid } from 'lucide-react'

const STAGES = ['new', 'contacted', 'qualified', 'demo_booked', 'proposal_sent', 'negotiating', 'won', 'lost'] as const
const STAGE_LABELS: Record<string, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', demo_booked: 'Demo booked', proposal_sent: 'Proposal sent', negotiating: 'Negotiating', won: 'Won', lost: 'Lost' }
const STAGE_COLORS: Record<string, string> = { new: '#1FA1D6', contacted: '#1B4F9E', qualified: '#8E2882', demo_booked: '#E5187A', proposal_sent: '#EE7C24', negotiating: '#F4D31E', won: '#0F8F4D', lost: '#D9211E' }
const SOURCES = ['Referral', 'Event', 'LinkedIn', 'Cold outreach', 'Website', 'Partner', 'Other']
const SIZES = ['small', 'medium', 'large', 'enterprise']

export function SalesLeads() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showAdd, setShowAdd] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', profile?.id, isAdmin],
    queryFn: async () => {
      let query = supabase.from('leads').select('*').eq('is_demo', getIsDemo()).order('updated_at', { ascending: false })
      if (!isAdmin) query = query.eq('owner_id', profile!.id)
      const { data, error } = await query
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const activeLeads = leads?.filter(l => l.stage !== 'won' && l.stage !== 'lost') ?? []
  const pipelineValue = activeLeads.reduce((s, l) => s + (l.estimated_value_pence ?? 0), 0)

  if (isLoading) return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Active leads" value={String(activeLeads.length)} color="#8E2882" />
          <MetricCard label="Pipeline value" value={`£${(pipelineValue / 100).toLocaleString()}`} trend="Estimated MRR if won" color="#0F8F4D" />
          <MetricCard label="Won" value={String(leads?.filter(l => l.stage === 'won').length ?? 0)} color="#0F8F4D" />
          <MetricCard label="Lost" value={String(leads?.filter(l => l.stage === 'lost').length ?? 0)} color="#D9211E" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button onClick={() => setView('kanban')} className={`text-sm px-3 py-1.5 rounded flex items-center gap-1 ${view === 'kanban' ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button onClick={() => setView('list')} className={`text-sm px-3 py-1.5 rounded flex items-center gap-1 ${view === 'list' ? 'bg-gray-900 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <button onClick={() => setShowAdd(true)} className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add lead
          </button>
        </div>

        {view === 'kanban' ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.filter(s => s !== 'won' && s !== 'lost').map(stage => {
              const stageLeads = leads?.filter(l => l.stage === stage) ?? []
              return (
                <div key={stage} className="min-w-[240px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS[stage] }} />
                    <span className="text-xs font-medium text-gray-700">{STAGE_LABELS[stage]}</span>
                    <span className="text-xs text-gray-400">{stageLeads.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map(lead => (
                      <Link key={lead.id} to={isAdmin ? `/admin/leads/${lead.id}` : `/sales/leads/${lead.id}`}
                        className="block bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-300 hover:shadow-sm transition">
                        <p className="text-sm font-medium text-gray-900">{lead.contact_name}</p>
                        <p className="text-xs text-gray-500">{lead.company_name}</p>
                        {lead.estimated_value_pence && <p className="text-xs font-medium text-gray-700 mt-1">£{(lead.estimated_value_pence / 100).toLocaleString()}/mo</p>}
                        {lead.next_action && <p className="text-[10px] text-gray-400 mt-1">{lead.next_action}</p>}
                      </Link>
                    ))}
                    {stageLeads.length === 0 && <div className="text-xs text-gray-300 text-center py-4">No leads</div>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <RainbowStripe height={3} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr className="text-xs uppercase tracking-wide text-gray-500">
                    <th className="text-left py-3 px-4 font-medium">Ref</th>
                    <th className="text-left py-3 px-4 font-medium">Contact</th>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Stage</th>
                    <th className="text-right py-3 px-4 font-medium">Value</th>
                    <th className="text-left py-3 px-4 font-medium">Source</th>
                    <th className="text-left py-3 px-4 font-medium">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {leads?.map(lead => (
                    <tr key={lead.id} onClick={() => window.location.href = isAdmin ? `/admin/leads/${lead.id}` : `/sales/leads/${lead.id}`} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                      <td className="py-3 px-4 font-mono text-xs text-gray-400">{lead.reference}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{lead.contact_name}</td>
                      <td className="py-3 px-4 text-gray-600">{lead.company_name}</td>
                      <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded" style={{ background: STAGE_COLORS[lead.stage] + '20', color: STAGE_COLORS[lead.stage] }}>{STAGE_LABELS[lead.stage]}</span></td>
                      <td className="py-3 px-4 text-right">{lead.estimated_value_pence ? `£${(lead.estimated_value_pence / 100).toLocaleString()}` : '—'}</td>
                      <td className="py-3 px-4 text-gray-500">{lead.source ?? '—'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{lead.next_action ?? '—'}</td>
                    </tr>
                  ))}
                  {(!leads || leads.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No leads yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Drawer open={showAdd} onClose={() => setShowAdd(false)} title="Add lead">
        <AddLeadForm ownerId={profile!.id} onCreated={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['leads'] }) }} />
      </Drawer>
    </>
  )
}

function AddLeadForm({ ownerId, onCreated }: { ownerId: string; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [company, setCompany] = useState('')
  const [size, setSize] = useState('')
  const [industry, setIndustry] = useState('')
  const [source, setSource] = useState('')
  const [value, setValue] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextDate, setNextDate] = useState('')

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').insert({
        reference: '', owner_id: ownerId, contact_name: name,
        contact_email: email || null, contact_phone: phone || null,
        job_title: jobTitle || null, company_name: company || null,
        company_size: size || null, industry: industry || null,
        source: source || null, estimated_value_pence: value ? Math.round(parseFloat(value) * 100) : null,
        next_action: nextAction || null, next_action_date: nextDate || null,
      })
      if (error) throw error
    },
    onSuccess: onCreated,
  })

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Contact name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Phone</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Job title</label><input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Company</label><input type="text" value={company} onChange={e => setCompany(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Size</label><select value={size} onChange={e => setSize(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm"><option value="">—</option>{SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Industry</label><input type="text" value={industry} onChange={e => setIndustry(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Source</label><select value={source} onChange={e => setSource(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm"><option value="">—</option>{SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Est. MRR (£)</label><input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="3500" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Next action</label><input type="text" value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="Follow up call" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
        <div><label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-1">Action date</label><input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" /></div>
      </div>
      {createMutation.isError && <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>}
      <button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
        {createMutation.isPending ? 'Creating...' : 'Add lead'}
      </button>
    </div>
  )
}
