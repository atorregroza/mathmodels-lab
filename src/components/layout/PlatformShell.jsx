import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../data/platformContent'

export const PlatformShell = ({ children }) => {
  const currentYear = new Date().getFullYear()

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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 md:px-8">
          <NavLink to="/deriva-lab" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink/15 bg-ink text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-paper shadow-[0_18px_50px_rgba(18,23,35,0.18)]">
              IB
            </span>
            <div>
              <p className="font-display text-xl font-bold leading-none">Deriva Lab</p>
              <p className="text-xs uppercase tracking-[0.28em] text-ink/55">Matemáticas IB</p>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-3 md:flex">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-ink text-paper' : 'text-ink/72 hover:bg-white/65 hover:text-ink'}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content" className="relative z-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-ink/10 bg-white/65">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-ink/70 md:flex-row md:items-center md:justify-between md:px-8">
          <p>
            Deriva Lab acompaña el estudio con laboratorios interactivos elaborados con IA y desarrollo asistido por Codex.
          </p>
          <p>© {currentYear} Astrid Torregroza Olivero · Lic. en Matemáticas y Física</p>
        </div>
      </footer>
    </div>
  )
}
