import { useState } from 'react'
import { Helmet } from 'react-helmet-async'

const WEB3FORMS_KEY = '5b745411-f4a2-4942-9943-1920fef72507'

export function FeedbackPage() {
  const [form, setForm] = useState({ role: '', rating: '', best: '', improve: '', useInClass: '', email: '' })
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `Feedback MathModels Lab — ${form.role}`,
          from_name: 'MathModels Lab Feedback',
          rol: form.role,
          valoracion: `${form.rating}/5`,
          lo_mejor: form.best,
          que_mejorar: form.improve,
          usaria_en_clase: form.useInClass,
          email_contacto: form.email || '(no proporcionado)',
        }),
      })
      if (res.ok) setStatus('sent')
      else setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <Helmet><title>Gracias — MathModels Lab</title></Helmet>
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-graph/15 text-graph">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Gracias por tu opinión</h1>
        <p className="mt-3 text-ink/60">Tu feedback nos ayuda a mejorar la plataforma. Lo revisaremos pronto.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <Helmet><title>Déjanos tu opinión — MathModels Lab</title></Helmet>

      <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Déjanos tu opinión</h1>
      <p className="mt-2 text-ink/60">
        Queremos saber qué te parece MathModels Lab. Tu feedback nos ayuda a mejorar los laboratorios, la navegación y el contenido.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Rol */}
        <fieldset>
          <legend className="text-sm font-semibold text-ink/80">¿Cuál es tu rol?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Estudiante', 'Docente', 'Coordinador/a', 'Otro'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => set('role', r)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${form.role === r ? 'bg-aqua text-white' : 'bg-ink/5 text-ink/60 hover:bg-ink/10'}`}
              >{r}</button>
            ))}
          </div>
        </fieldset>

        {/* Valoración */}
        <fieldset>
          <legend className="text-sm font-semibold text-ink/80">¿Cómo valorarías la plataforma?</legend>
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => set('rating', String(n))}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold transition-all ${Number(form.rating) >= n ? 'bg-aqua text-white scale-110' : 'bg-ink/5 text-ink/40 hover:bg-ink/10'}`}
              >{n}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink/40">1 = Necesita mucho trabajo · 5 = Excelente</p>
        </fieldset>

        {/* Lo mejor */}
        <div>
          <label className="text-sm font-semibold text-ink/80">¿Qué es lo que más te gustó?</label>
          <textarea
            value={form.best}
            onChange={e => set('best', e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-aqua/40 focus:ring-2 focus:ring-aqua/10"
            placeholder="Los laboratorios interactivos, la navegación, el diseño..."
          />
        </div>

        {/* Qué mejorar */}
        <div>
          <label className="text-sm font-semibold text-ink/80">¿Qué mejorarías o cambiarías?</label>
          <textarea
            value={form.improve}
            onChange={e => set('improve', e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-aqua/40 focus:ring-2 focus:ring-aqua/10"
            placeholder="Algo confuso, algo que falta, algo que sobra..."
          />
        </div>

        {/* Uso en clase */}
        <fieldset>
          <legend className="text-sm font-semibold text-ink/80">¿Usarías esta plataforma en clase?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Sí, definitivamente', 'Tal vez', 'No creo', 'No aplica'].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => set('useInClass', r)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${form.useInClass === r ? 'bg-aqua text-white' : 'bg-ink/5 text-ink/60 hover:bg-ink/10'}`}
              >{r}</button>
            ))}
          </div>
        </fieldset>

        {/* Email opcional */}
        <div>
          <label className="text-sm font-semibold text-ink/80">Correo electrónico <span className="font-normal text-ink/40">(opcional, si quieres que te contactemos)</span></label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            className="mt-2 w-full rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-aqua/40 focus:ring-2 focus:ring-aqua/10"
            placeholder="tu@correo.com"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'sending' || !form.role || !form.rating}
          className="w-full rounded-full bg-aqua py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(80,150,255,0.25)] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'sending' ? 'Enviando...' : 'Enviar opinión'}
        </button>

        {status === 'error' && (
          <p className="text-center text-sm text-red-500">Hubo un error al enviar. Intenta de nuevo.</p>
        )}
      </form>
    </div>
  )
}
