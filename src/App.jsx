import { lazy, Suspense, useEffect } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PlatformShell } from './components/layout/PlatformShell'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

const DerivaHomePage = lazy(() => import('./pages/DerivaHomePage').then(m => ({ default: m.DerivaHomePage })))
const StudyRoutePage = lazy(() => import('./pages/StudyRoutePage').then(m => ({ default: m.StudyRoutePage })))
const ExplorationBlockPage = lazy(() => import('./pages/ExplorationBlockPage').then(m => ({ default: m.ExplorationBlockPage })))
const UnitPage = lazy(() => import('./pages/UnitPage').then(m => ({ default: m.UnitPage })))
const LabsLibraryPage = lazy(() => import('./pages/LabsLibraryPage').then(m => ({ default: m.LabsLibraryPage })))
const LabPage = lazy(() => import('./pages/LabPage').then(m => ({ default: m.LabPage })))
const ModelacionPage = lazy(() => import('./pages/ModelacionPage').then(m => ({ default: m.ModelacionPage })))
const CalculadoraPage = lazy(() => import('./pages/CalculadoraPage').then(m => ({ default: m.CalculadoraPage })))
const MonografiaPage = lazy(() => import('./pages/MonografiaPage').then(m => ({ default: m.MonografiaPage })))
const MonografiaSimPage = lazy(() => import('./pages/MonografiaSimPage').then(m => ({ default: m.MonografiaSimPage })))
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then(m => ({ default: m.FeedbackPage })))

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<div className="py-16 text-center text-gray-600">Cargando...</div>}>
          <Routes>
            {/* Standalone calculator — no shell, opens in popup */}
            <Route path="/calculadora" element={<CalculadoraPage />} />
            {/* Main app with shell */}
            <Route path="*" element={
              <PlatformShell>
                <Routes>
                  <Route path="/" element={<DerivaHomePage />} />
                  <Route path="/secuencia" element={<StudyRoutePage />} />
                  <Route path="/exploraciones/:blockId" element={<ExplorationBlockPage />} />
                  <Route path="/unidades/:unitId" element={<UnitPage />} />
                  <Route path="/laboratorios" element={<LabsLibraryPage />} />
                  <Route path="/laboratorios/:labId" element={<LabPage />} />
                  <Route path="/modelacion" element={<ModelacionPage />} />
                  <Route path="/monografias" element={<MonografiaPage />} />
                  <Route path="/monografias/:simId" element={<MonografiaSimPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                </Routes>
              </PlatformShell>
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  )
}

export default App
