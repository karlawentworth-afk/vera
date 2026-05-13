import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { RainbowStripe } from '../../components/shared/RainbowStripe'
import { Send, CreditCard, Receipt, Download } from 'lucide-react'

const COLORS = { green: '#0F8F4D', orange: '#EE7C24' }

export function AdminInvoices() {
  const { data: subscriptions } = useQuery({
    queryKey: ['invoice-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, organisation:organisations(name)')
        .eq('status', 'active')
      if (error) throw error
      return data
    },
  })

  const { data: reviewers } = useQuery({
    queryKey: ['invoice-reviewers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, rate_per_word')
        .eq('role', 'reviewer')
      if (error) throw error
      return data
    },
  })

  const { data: deliveredJobs } = useQuery({
    queryKey: ['invoice-delivered-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('reviewer_id, word_count')
        .eq('status', 'delivered')
      if (error) throw error
      return data
    },
  })

  const { data: activeJobs } = useQuery({
    queryKey: ['invoice-active-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('reviewer_id, word_count')
        .in('status', ['in_review', 'awaiting_signoff', 'allocated'])
      if (error) throw error
      return data
    },
  })

  // Client invoices total
  const clientTotal = subscriptions?.reduce((sum, s) => sum + s.monthly_price_pence, 0) ?? 0

  // Reviewer payouts — sum words × rate for each reviewer
  const reviewerOwed: Record<string, number> = {}
  const allReviewerJobs = [...(deliveredJobs ?? []), ...(activeJobs ?? [])]
  allReviewerJobs.forEach(j => {
    if (j.reviewer_id) {
      reviewerOwed[j.reviewer_id] = (reviewerOwed[j.reviewer_id] ?? 0) + j.word_count
    }
  })

  const reviewerPayoutList = reviewers?.map(r => {
    const words = reviewerOwed[r.id] ?? 0
    const amount = Math.round(words * Number(r.rate_per_word ?? 0) * 100)
    return { ...r, words, amount }
  }).filter(r => r.words > 0) ?? []

  const reviewerTotal = reviewerPayoutList.reduce((sum, r) => sum + r.amount, 0)

  // Simulated recent activity
  const recentActivity = [
    ...(subscriptions?.map(s => ({
      type: 'invoice' as const,
      desc: `Subscription invoice — ${(s.organisation as { name: string })?.name}`,
      amount: s.monthly_price_pence,
      time: 'This month',
    })) ?? []),
    ...reviewerPayoutList.map(r => ({
      type: 'reviewer' as const,
      desc: `Payout — ${r.full_name} (${r.words.toLocaleString()} words)`,
      amount: -r.amount,
      time: '28th',
    })),
  ]

  function toastPlaceholder(msg: string) {
    alert(msg)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client invoices */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="h-1" style={{ background: COLORS.green }} />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Client invoices</h3>
              <button
                onClick={() => toastPlaceholder('Stripe integration coming in Phase 6. Invoices will be auto-generated and synced to Xero.')}
                className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2"
              >
                <Send className="w-3 h-3" /> Run monthly batch
              </button>
            </div>
            <p className="text-2xl font-light text-gray-900">£{(clientTotal / 100).toLocaleString()}<span className="text-sm text-gray-500"> awaiting</span></p>
            <p className="text-xs text-gray-500 mt-1">{subscriptions?.length ?? 0} invoices · sync to Xero on issue</p>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              {subscriptions?.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{(s.organisation as { name: string })?.name}</span>
                  <span className="font-medium">£{(s.monthly_price_pence / 100).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviewer payouts */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="h-1" style={{ background: COLORS.orange }} />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Reviewer payouts</h3>
              <button
                onClick={() => toastPlaceholder('Stripe Connect integration coming in Phase 6. Payouts will be processed automatically on the 28th.')}
                className="text-xs bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 flex items-center gap-2"
              >
                <CreditCard className="w-3 h-3" /> Process all
              </button>
            </div>
            <p className="text-2xl font-light text-gray-900">£{(reviewerTotal / 100).toLocaleString()}<span className="text-sm text-gray-500"> to pay 28th</span></p>
            <p className="text-xs text-gray-500 mt-1">{reviewerPayoutList.length} reviewers · statements auto-generated</p>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              {reviewerPayoutList.map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{r.full_name}</span>
                  <span className="font-medium">£{(r.amount / 100).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Recent activity</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS.green }} />
                Xero sync: connected
              </div>
              <button
                onClick={() => toastPlaceholder('Xero export coming in Phase 6.')}
                className="flex items-center gap-1 text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50"
              >
                <Download className="w-3 h-3" /> Export to Xero
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {recentActivity.map((row, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 py-2 border-b border-gray-50 last:border-0 items-center text-sm">
                <div className="col-span-1">
                  {row.type === 'invoice' && <Receipt className="w-4 h-4 text-gray-400" />}
                  {row.type === 'reviewer' && <CreditCard className="w-4 h-4 text-gray-400" />}
                </div>
                <span className="col-span-7 text-gray-700">{row.desc}</span>
                <span className={`col-span-2 text-right font-medium ${row.amount < 0 ? 'text-gray-500' : 'text-gray-900'}`}>
                  {row.amount < 0 ? '-' : ''}£{Math.abs(row.amount / 100).toLocaleString()}
                </span>
                <span className="col-span-2 text-xs text-gray-500 text-right">{row.time}</span>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
