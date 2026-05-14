import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { getIsDemo } from '../../lib/queryHelpers'
import { inviteUser } from '../../lib/invite'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Drawer } from '../../components/shared/Drawer'
import { LANGUAGES } from '../../lib/constants'
import { Plus, Edit3 } from 'lucide-react'

const COLORS = { green: '#0F8F4D', cyan: '#1FA1D6' }

export function AdminReviewers() {
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const { data: reviewers, isLoading } = useQuery({
    queryKey: ['admin-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'reviewer')
        .eq('is_demo', getIsDemo())
        .order('full_name')
      if (error) throw error
      return data
    },
  })

  const { data: activeJobs } = useQuery({
    queryKey: ['admin-active-jobs-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('reviewer_id, word_count, status')
        .eq('is_demo', getIsDemo())
        .not('reviewer_id', 'is', null)
        .in('status', ['in_review', 'awaiting_signoff'])
      if (error) throw error
      return data
    },
  })

  const { data: deliveredJobs } = useQuery({
    queryKey: ['admin-delivered-jobs-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('reviewer_id, word_count')
        .eq('is_demo', getIsDemo())
        .eq('status', 'delivered')
      if (error) throw error
      return data
    },
  })

  const { data: scores } = useQuery({
    queryKey: ['admin-reviewer-scores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scores')
        .select('reviewer_id, hter_score')
        .eq('is_demo', getIsDemo())
      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return <div className="bg-white border border-gray-200 rounded-lg h-96 animate-pulse" />
  }

  // Active job counts per reviewer
  const activeJobCounts: Record<string, number> = {}
  activeJobs?.forEach(j => {
    if (j.reviewer_id) activeJobCounts[j.reviewer_id] = (activeJobCounts[j.reviewer_id] ?? 0) + 1
  })

  // Delivered word counts per reviewer (for earnings estimate)
  const deliveredWords: Record<string, number> = {}
  deliveredJobs?.forEach(j => {
    if (j.reviewer_id) deliveredWords[j.reviewer_id] = (deliveredWords[j.reviewer_id] ?? 0) + j.word_count
  })

  // Active words (for current month owed estimate)
  const activeWords: Record<string, number> = {}
  activeJobs?.forEach(j => {
    if (j.reviewer_id) activeWords[j.reviewer_id] = (activeWords[j.reviewer_id] ?? 0) + j.word_count
  })

  // Avg hTER per reviewer
  const reviewerHter: Record<string, number[]> = {}
  scores?.forEach(s => {
    if (!reviewerHter[s.reviewer_id]) reviewerHter[s.reviewer_id] = []
    reviewerHter[s.reviewer_id].push(Number(s.hter_score))
  })

  const freeCount = reviewers?.filter(r => !activeJobCounts[r.id]).length ?? 0

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{reviewers?.length ?? 0} active freelance reviewers · {freeCount} free</p>
        <button onClick={() => setShowInvite(true)} className="text-sm bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Add reviewer
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="text-left py-3 px-4 font-medium">Name</th>
                <th className="text-left py-3 px-4 font-medium">Languages</th>
                <th className="text-left py-3 px-4 font-medium">Specialism</th>
                <th className="text-right py-3 px-4 font-medium">Rate / word</th>
                <th className="text-right py-3 px-4 font-medium">Active</th>
                <th className="text-right py-3 px-4 font-medium">Avg. hTER</th>
                <th className="text-right py-3 px-4 font-medium">Owed (est.)</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reviewers?.map(r => {
                const count = activeJobCounts[r.id] ?? 0
                const isFree = count === 0
                const rate = Number(r.rate_per_word ?? 0)
                const totalWords = (deliveredWords[r.id] ?? 0) + (activeWords[r.id] ?? 0)
                const owed = Math.round(totalWords * rate)
                const hterArr = reviewerHter[r.id] ?? []
                const avgHter = hterArr.length > 0
                  ? (hterArr.reduce((a, b) => a + b, 0) / hterArr.length).toFixed(2)
                  : '—'

                return (
                  <tr key={r.id} onClick={() => window.location.href = `/admin/reviewers/${r.id}`} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                    <td className="py-3 px-4 font-medium text-gray-900">{r.full_name}</td>
                    <td className="py-3 px-4 text-gray-600">{r.languages?.join(', ') ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{r.specialism ?? '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-900">£{rate.toFixed(3)}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{count}</td>
                    <td className="py-3 px-4 text-right text-gray-600 font-mono">{avgHter}</td>
                    <td className="py-3 px-4 text-right font-medium">£{owed.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded" style={{
                        background: isFree ? COLORS.green + '20' : COLORS.cyan + '20',
                        color: isFree ? COLORS.green : COLORS.cyan,
                      }}>
                        {isFree ? 'Free' : 'Available'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right"><Edit3 className="w-4 h-4 text-gray-400" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <Drawer open={showInvite} onClose={() => setShowInvite(false)} title="Add reviewer">
      <ReviewerInviteForm onSuccess={() => {
        setShowInvite(false)
        queryClient.invalidateQueries({ queryKey: ['admin-reviewers'] })
      }} />
    </Drawer>
    </>
  )
}

function ReviewerInviteForm({ onSuccess }: { onSuccess: () => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [langs, setLangs] = useState<string[]>([])
  const [langInput, setLangInput] = useState({ source: 'EN', target: 'DE' })
  const [specialism, setSpecialism] = useState('')
  const [rate, setRate] = useState('0.045')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    const result = await inviteUser({
      email,
      full_name: `${firstName} ${lastName}`.trim(),
      role: 'reviewer',
      languages: langs,
      specialism: specialism || undefined,
      rate_per_word: parseFloat(rate) || undefined,
    })
    setSubmitting(false)
    if (result.success) {
      alert(`${firstName} ${lastName} invited as reviewer. Welcome email sent to ${email}`)
      onSuccess()
    } else {
      setError(result.error || 'Failed to invite')
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">First name</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Last name</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="anna@example.com" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Language pairs</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {langs.map((l, i) => (
            <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1 flex items-center gap-1">
              {l} <button onClick={() => setLangs(langs.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <select value={langInput.source} onChange={e => setLangInput(p => ({ ...p, source: e.target.value }))} className="text-sm border border-gray-200 rounded px-2 py-1.5">
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="text-gray-400">→</span>
          <select value={langInput.target} onChange={e => setLangInput(p => ({ ...p, target: e.target.value }))} className="text-sm border border-gray-200 rounded px-2 py-1.5">
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={() => { const pair = `${langInput.source} → ${langInput.target}`; if (!langs.includes(pair)) setLangs([...langs, pair]) }} className="text-xs bg-gray-100 rounded px-2 py-1.5 hover:bg-gray-200">Add</button>
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Specialism</label>
        <input type="text" value={specialism} onChange={e => setSpecialism(e.target.value)} placeholder="Technical, Compliance, Marketing" className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-gray-500 font-medium block mb-2">Rate per word (£)</label>
        <input type="number" step="0.001" value={rate} onChange={e => setRate(e.target.value)} className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={handleSubmit} disabled={!firstName || !email || langs.length === 0 || submitting} className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
        {submitting ? 'Creating...' : 'Add reviewer & send invite'}
      </button>
    </div>
  )
}
