import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { navigationItems } from '../../data/platformContent'
import { ScientificCalculator } from '../features/ScientificCalculator'

export function Breadcrumb({ items }) {
  if (!items?.length) return null
  return (
    <nav className="mx-auto max-w-7xl px-5 pt-4 md:px-8" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink/45">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink/25">›</span>}
            {item.to ? (
              <Link to={item.to} className="transition-colors hover:text-signal">{item.label}</Link>
            ) : (
              <span className="font-medium text-ink/65">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export const PlatformShell = ({ children }) => {
  const currentYear = new Date().getFullYear()
  const [calcOpen, setCalcOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-12rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full bg-signal/18 blur-3xl" />
        <div className="absolute right-[-8rem] top-[9rem] h-[30rem] w-[30rem] rounded-full bg-graph/18 blur-3xl" />
        <div className="absolute inset-0 lab-grid opacity-55" />
        <div className="absolute inset-0 grain-mask opacity-35" />
      </div>

      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <NavLink to="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl shadow-[0_18px_50px_rgba(18,23,35,0.18)]">
              <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
                <rect width="48" height="48" rx="12" fill="#121723"/>
                <path d="M 8,36 C 10,36 14,9 17.5,9 C 21,9 21,28 24,28 C 27,28 27,9 30.5,9 C 34,9 38,36 40,36"
                      fill="none" stroke="#22c5a0" strokeWidth="3" strokeLinecap="round"/>
                <line x1="10.5" y1="9" x2="24.5" y2="9" stroke="#ff6b35" strokeWidth="1.5" strokeLinecap="round" opacity="0.75"/>
                <circle cx="17.5" cy="9" r="3" fill="#ff6b35"/>
              </svg>
            </span>
            <p className="font-display text-xl font-bold leading-none">MathModels Lab</p>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-3 md:flex">
            {navigationItems.map((item) => (
              item.submenu ? (
                <div key={item.label} className="relative group">
                  <button className="rounded-full px-4 py-2 text-sm font-semibold text-ink/72 transition-colors hover:bg-white/65 hover:text-ink">
                    {item.label}
                    <svg className="ml-1 inline-block h-3 w-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3"/></svg>
                  </button>
                  <div className="invisible pointer-events-none absolute left-0 top-full pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100">
                    <div className="min-w-[14rem] rounded-xl border border-ink/10 bg-white p-1.5 shadow-[0_12px_40px_rgba(18,23,35,0.12)]">
                      {item.submenu.map((sub) => (
                        sub.disabled ? (
                          <span key={sub.to} className="flex flex-col rounded-lg px-3 py-2.5 text-ink/30">
                            <span className="flex items-center gap-2 text-sm font-semibold">
                              {sub.label}
                              <span className="rounded-full bg-signal/15 px-1.5 py-0 text-[0.5rem] font-bold text-signal/70">pronto</span>
                            </span>
                            <span className="text-[0.7rem] text-ink/25">{sub.description}</span>
                          </span>
                        ) : (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            className={({ isActive }) => `flex flex-col rounded-lg px-3 py-2.5 transition-colors ${isActive ? 'bg-ink/5' : 'hover:bg-ink/4'}`}
                          >
                            <span className="text-sm font-semibold text-ink/80">{sub.label}</span>
                            <span className="text-[0.7rem] text-ink/45">{sub.description}</span>
                          </NavLink>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-ink text-paper' : 'text-ink/72 hover:bg-white/65 hover:text-ink'}`}
                >
                  {item.label}
                </NavLink>
              )
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink/10 md:hidden"
            aria-label="Menú"
          >
            {mobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-ink/8 md:hidden"
            >
              <nav className="flex flex-col gap-1 px-5 py-4">
                {navigationItems.map((item) => (
                  item.submenu ? (
                    <div key={item.label} className="flex flex-col">
                      <span className="px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-widest text-ink/40">
                        {item.label}
                      </span>
                      {item.submenu.map((sub) => (
                        sub.disabled ? (
                          <span key={sub.to} className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-ink/30">
                            {sub.label}
                            <span className="rounded-full bg-signal/15 px-1.5 py-0.5 text-[0.5rem] font-bold text-signal/70">pronto</span>
                          </span>
                        ) : (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) => `rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors ${isActive ? 'bg-ink text-paper' : 'text-ink/72 hover:bg-white/65'}`}
                          >
                            {sub.label}
                          </NavLink>
                        )
                      ))}
                    </div>
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) => `rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${isActive ? 'bg-ink text-paper' : 'text-ink/72 hover:bg-white/65'}`}
                    >
                      {item.label}
                    </NavLink>
                  )
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content" className="relative z-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-ink/10 bg-white/65">
        <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
          <div className="flex flex-col gap-4 text-sm text-ink/70 md:flex-row md:items-center md:justify-between">
            <p>
              MathModels Lab acompaña el estudio con laboratorios interactivos elaborados con IA y desarrollo asistido por Claude Code.
            </p>
            <p>© {currentYear} Astrid Torregroza Olivero</p>
          </div>
          <div className="mt-4 pt-4 border-t border-ink/6 flex flex-col gap-2 text-xs text-ink/45 md:flex-row md:items-center md:justify-between">
            <p>Talleres y acompañamiento en matemáticas</p>
            <a href="https://wa.me/573153189366?text=Hola%20Astrid%2C%20me%20interesa%20información%20sobre%20los%20talleres%20de%20MathModels%20Lab." target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#25D366] font-medium hover:underline">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Escríbeme por WhatsApp
            </a>
          </div>
        </div>
      </footer>

      <ScientificCalculator open={calcOpen} onToggle={() => setCalcOpen(v => !v)} />
    </div>
  )
}
