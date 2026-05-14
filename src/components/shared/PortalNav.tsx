import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, X, HelpCircle } from 'lucide-react'
import { VeraLogo } from './VeraLogo'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

interface PortalNavProps {
  items: NavItem[]
  badge?: { label: string; bg: string; color: string }
  rightContent?: React.ReactNode
}

export function PortalNav({ items, badge, rightContent }: PortalNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-8">
          <VeraLogo size="sm" />
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          )}
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {items.map(item => (
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
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <a href="/help" className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Help">
            <HelpCircle className="w-4 h-4" />
          </a>
          {rightContent}
          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 px-4 py-2 space-y-1">
          {items.map(item => (
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
          ))}
        </div>
      )}
    </div>
  )
}
