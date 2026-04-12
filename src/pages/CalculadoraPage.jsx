import { ScientificCalculator } from '../components/features/ScientificCalculator'

export function CalculadoraPage() {
  return (
    <div className="min-h-screen bg-ink">
      <ScientificCalculator open={true} onToggle={() => {}} standalone />
    </div>
  )
}
