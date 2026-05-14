import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { RainbowStripe } from '../components/shared/RainbowStripe'
import { Search, ThumbsUp, ThumbsDown, Mail } from 'lucide-react'

const CATEGORY_LABELS: Record<string, string> = {
  getting_started: 'Getting started',
  submitting_work: 'Submitting work',
  scoring: 'Scoring & quality',
  invoicing: 'Invoicing & payments',
  ai_features: 'AI features',
  account: 'Account & profile',
  troubleshooting: 'Troubleshooting',
  admin: 'Administration',
  sales: 'Sales & leads',
}

export function HelpPage() {
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null)

  const { data: articles } = useQuery({
    queryKey: ['help-articles', profile?.role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('help_articles')
        .select('*')
        .eq('is_draft', false)
        .contains('audience', [profile!.role])
        .order('category')
        .order('order_index')
      if (error) throw error
      return data
    },
    enabled: !!profile,
  })

  const filtered = articles?.filter(a => {
    if (search) {
      const q = search.toLowerCase()
      return a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
    }
    if (selectedCategory) return a.category === selectedCategory
    return true
  }) ?? []

  const categories = [...new Set(articles?.map(a => a.category) ?? [])]
  const categoryCounts: Record<string, number> = {}
  articles?.forEach(a => { categoryCounts[a.category] = (categoryCounts[a.category] ?? 0) + 1 })

  const article = selectedArticle ? articles?.find(a => a.id === selectedArticle) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={4} />
        <div className="p-6">
          <h1 className="text-xl font-light text-gray-900 mb-1">Help & documentation</h1>
          <p className="text-sm text-gray-500 mb-4">Find answers about using Vera. Search or browse by category.</p>

          <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 mb-4 text-xs text-yellow-800">
            Help is being actively developed. If something's missing or unclear, tell us — emma@ecls-translations.com
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setSelectedArticle(null); setSelectedCategory(null) }}
              placeholder="Search help articles..." className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400" />
          </div>

          {article ? (
            /* Article view */
            <div>
              <button onClick={() => setSelectedArticle(null)} className="text-sm text-gray-500 hover:text-gray-900 mb-4">&larr; Back to articles</button>
              <h2 className="text-lg font-medium text-gray-900 mb-2">{article.title}</h2>
              <p className="text-xs text-gray-400 mb-4">
                {CATEGORY_LABELS[article.category] ?? article.category}
                {article.updated_at && ` · Updated ${new Date(article.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              </p>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">{article.body}</div>

              <div className="mt-8 pt-4 border-t border-gray-100">
                <FeedbackButtons articleId={article.id} userId={profile?.id} />
              </div>

              <div className="mt-4 text-xs text-gray-400">
                <a href="mailto:emma@ecls-translations.com" className="inline-flex items-center gap-1 hover:text-gray-600">
                  <Mail className="w-3 h-3" /> Contact support
                </a>
              </div>
            </div>
          ) : (
            /* Browse view */
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Categories sidebar */}
              <div className="space-y-1">
                <button onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded ${!selectedCategory ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  All ({articles?.length ?? 0})
                </button>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded ${selectedCategory === cat ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {CATEGORY_LABELS[cat] ?? cat} ({categoryCounts[cat] ?? 0})
                  </button>
                ))}
              </div>

              {/* Article list */}
              <div className="md:col-span-3 space-y-2">
                {filtered.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No articles found{search ? ` for "${search}"` : ''}.</p>}
                {filtered.map(a => (
                  <button key={a.id} onClick={() => setSelectedArticle(a.id)}
                    className="w-full text-left p-3 border border-gray-100 rounded-lg hover:border-gray-300 transition">
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{CATEGORY_LABELS[a.category] ?? a.category}</p>
                    {search && <p className="text-xs text-gray-400 mt-1 truncate">{a.body.substring(0, 120)}...</p>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FeedbackButtons({ articleId, userId }: { articleId: string; userId?: string }) {
  const [submitted, setSubmitted] = useState<boolean | null>(null)

  const feedbackMutation = useMutation({
    mutationFn: async (helpful: boolean) => {
      await supabase.from('help_feedback').insert({ article_id: articleId, user_id: userId ?? null, helpful })
    },
    onSuccess: (_, helpful) => setSubmitted(helpful),
  })

  if (submitted !== null) {
    return <p className="text-sm text-gray-500">Thanks for your feedback!</p>
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500">Was this helpful?</span>
      <button onClick={() => feedbackMutation.mutate(true)} className="text-sm text-gray-500 hover:text-green-600 flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> Yes</button>
      <button onClick={() => feedbackMutation.mutate(false)} className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1"><ThumbsDown className="w-4 h-4" /> No</button>
    </div>
  )
}
