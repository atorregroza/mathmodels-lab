import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { navigationItems } from '../../data/platformContent'
import { ScientificCalculator } from '../features/ScientificCalculator'

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
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-ink text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-paper shadow-[0_18px_50px_rgba(18,23,35,0.18)]">
              ML
            </span>
            <div>
              <p className="font-display text-xl font-bold leading-none">MathModels Lab</p>
              <p className="hidden text-xs uppercase tracking-[0.28em] text-ink/55 sm:block">Matemáticas</p>
            </div>
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
                  <div className="pointer-events-none absolute left-0 top-full pt-2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:opacity-100">
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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-ink/70 md:flex-row md:items-center md:justify-between md:px-8">
          <p>
            MathModels Lab acompaña el estudio con laboratorios interactivos elaborados con IA y desarrollo asistido por Claude Code.
          </p>
          <p>© {currentYear} Astrid Torregroza Olivero · Lic. en Matemáticas y Física</p>
        </div>
      </footer>

      <ScientificCalculator open={calcOpen} onToggle={() => setCalcOpen(v => !v)} />
    </div>
  )
}
