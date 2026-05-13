import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { RainbowStripe } from './RainbowStripe'
import { Upload, BarChart3, BookOpen, ChevronRight } from 'lucide-react'

const STEPS = [
  {
    icon: Upload,
    title: 'Submit your first job',
    desc: 'Upload AI-translated content and we\'ll assign an expert reviewer within 30 minutes.',
    link: '/client/submit',
    linkLabel: 'Submit work',
  },
  {
    icon: BarChart3,
    title: 'Your AI Health Score',
    desc: 'See how your AI translation tools perform across languages and content types.',
    link: '/client/audit',
    linkLabel: 'View AI health',
  },
  {
    icon: BookOpen,
    title: 'Add your glossary',
    desc: 'Terminology and brand voice notes improve review quality and AI pre-flight accuracy.',
    link: '/client/glossary',
    linkLabel: 'Manage glossary',
  },
]

export function OnboardingOverlay() {
  const { profile } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (!profile || profile.role !== 'client' || profile.onboarding_completed_at || dismissed) return null

  async function complete() {
    setDismissed(true)
    await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', profile!.id)
  }

  const firstName = profile.full_name?.split(' ')[0] ?? ''

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
          <RainbowStripe height={4} />
          <div className="p-8">
            <h2 className="text-xl font-light text-gray-900 mb-2">
              Welcome to Vera{firstName ? `, ${firstName}` : ''}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Here's a quick guide to get the most from your AI translation governance platform.
            </p>

            <div className="space-y-4">
              {STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <Link
                    key={i}
                    to={step.link}
                    onClick={complete}
                    className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg hover:border-gray-300 transition group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700">{step.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
                  </Link>
                )
              })}
            </div>

            <button onClick={complete} className="mt-6 w-full text-sm text-gray-500 hover:text-gray-700">
              Skip for now — I'll explore on my own
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
