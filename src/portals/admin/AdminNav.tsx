import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { VeraLogo } from '../../components/shared/VeraLogo'
import { Menu, X, ChevronDown, Settings, FileText, Users, Briefcase, ClipboardList, Receipt, Shield } from 'lucide-react'

interface NavGroup {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean }[]
}

interface NavSingle {
  to: string
  label: string
  end?: boolean
}

type NavItem = NavSingle | NavGroup

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', end: true },
  {
    label: 'Operations',
    icon: Briefcase,
    children: [
      { to: '/admin/jobs', label: 'Jobs', icon: FileText },
      { to: '/admin/audit-log', label: 'Audit log', icon: Shield },
      { to: '/admin/cron', label: 'Scheduled jobs', icon: ClipboardList },
    ],
  },
  {
    label: 'People',
    icon: Users,
    children: [
      { to: '/admin/clients', label: 'Clients', icon: Users },
      { to: '/admin/reviewers', label: 'Reviewers', icon: Users },
      { to: '/admin/sales', label: 'Sales & commissions', icon: Users },
    ],
  },
  {
    label: 'Pipeline',
    icon: ClipboardList,
    children: [
      { to: '/admin/quotes', label: 'Quotes', icon: ClipboardList },
      { to: '/admin/invoices', label: 'Invoices & Pay', icon: Receipt },
    ],
  },
  { to: '/admin/insights', label: 'Insights' },
]

function Dropdown({ group, mobileMode }: { group: NavGroup; mobileMode?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const isChildActive = group.children.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (mobileMode) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium px-3 pt-3 pb-1">{group.label}</p>
        {group.children.map(child => (
          <NavLink
            key={child.to}
            to={child.to}
            className={({ isActive }) =>
              `block px-3 py-2 text-sm rounded ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            {child.label}
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
          isChildActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        {group.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
          onMouseLeave={() => setOpen(false)}
        >
          {group.children.map(child => {
            const Icon = child.icon
            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 text-sm ${isActive ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`
                }
              >
                <Icon className="w-4 h-4 text-gray-400" />
                {child.label}
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface AdminNavProps {
  rightContent?: React.ReactNode
}

export function AdminNav({ rightContent }: AdminNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <VeraLogo size="sm" />
          <span className="text-xs px-2 py-0.5 rounded bg-gray-900 text-white">Admin</span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item, i) =>
              isGroup(item) ? (
                <Dropdown key={i} group={item} />
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`
                  }
                >
                  {item.label}
                </NavLink>
              )
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {rightContent}
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `w-8 h-8 rounded flex items-center justify-center ${isActive ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`
            }
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </NavLink>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
          >
            {mobileOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 px-4 py-2 space-y-1">
          {NAV.map((item, i) =>
            isGroup(item) ? (
              <Dropdown key={i} group={item} mobileMode />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 text-sm rounded ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`
                }
              >
                {item.label}
              </NavLink>
            )
          )}
          <NavLink
            to="/admin/settings"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `block px-3 py-2 text-sm rounded ${isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`
            }
          >
            Settings & Pricing
          </NavLink>
        </div>
      )}
    </div>
  )
}
