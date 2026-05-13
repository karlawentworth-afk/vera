import { FileText, Receipt, Settings, Upload, BarChart3, CreditCard, ClipboardList, Star, Clock } from 'lucide-react'
import { RainbowStripe } from './RainbowStripe'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'file-text': FileText,
  'receipt': Receipt,
  'settings': Settings,
  'upload': Upload,
  'bar-chart': BarChart3,
  'credit-card': CreditCard,
  'clipboard': ClipboardList,
  'star': Star,
  'clock': Clock,
}

interface PlaceholderPageProps {
  title: string
  icon: string
  items: string[]
}

export function PlaceholderPage({ title, icon, items }: PlaceholderPageProps) {
  const Icon = ICONS[icon] || FileText

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg overflow-hidden">
        <RainbowStripe height={3} />
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-1">{title}</h2>
          <p className="text-xs uppercase tracking-widest text-gray-400 font-medium mb-6">Coming soon</p>
          <ul className="text-left space-y-3">
            {items.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-600">
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-400 shrink-0 mt-0.5">
                  {i + 1}
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
