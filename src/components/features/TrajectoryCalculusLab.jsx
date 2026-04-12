import { useState } from 'react'
import { CartesianFrame, LabCard, MetricCard, SliderField } from './DerivaLabPrimitives'
import { downloadCsv, format, linePath, sampleRange } from './derivaLabUtils'

const buildTicks = (maxValue, count = 4) => (
  Array.from({ length: count + 1 }, (_, index) => Number(((maxValue * index) / count).toFixed(2)))
)

export const TrajectoryCalculusLab = () => {
  const [speed, setSpeed] = useState(18)
  const [angle, setAngle] = useState(58)
  const [height0, setHeight0] = useState(1.5)
  const [gravity, setGravity] = useState(9.8)
  const [time, setTime] = useState(0)

  const angleRad = angle * Math.PI / 180
  const vx = speed * Math.cos(angleRad)
  const vy0 = speed * Math.sin(angleRad)
  const flightTime = (vy0 + Math.sqrt((vy0 ** 2) + (2 * gravity * height0))) / gravity
  const peakTime = vy0 / gravity
  const currentTime = Math.min(time, flightTime)
  const current = {
    x: vx * currentTime,
    y: Math.max(0, height0 + (vy0 * currentTime) - ((gravity * currentTime ** 2) / 2)),
    vy: vy0 - (gravity * currentTime),
    ay: -gravity,
  }
  const peak = {
    x: vx * peakTime,
    y: height0 + (vy0 ** 2) / (2 * gravity),
  }
  const sceneXMax = Math.max(peak.x * 2, current.x + 1, 6)
  const sceneYMax = Math.max(peak.y * 1.15, 6)

  const motionPoints = sampleRange(0, flightTime, 80, (t) => Math.max(0, height0 + (vy0 * t) - ((gravity * t ** 2) / 2))).map((point) => ({
    x: vx * point.x,
    y: point.y,
  }))
  const heightPoints = sampleRange(0, flightTime, 80, (t) => height0 + (vy0 * t) - ((gravity * t ** 2) / 2))
  const velocityPoints = sampleRange(0, flightTime, 40, (t) => vy0 - (gravity * t))
  const accelPoints = sampleRange(0, flightTime, 10, () => -gravity)
  const timeTicks = buildTicks(flightTime)
  const heightTicks = buildTicks(Math.max(peak.y * 1.1, 4))
  const velocityMin = Math.min(...velocityPoints.map((point) => point.y))
  const velocityMax = Math.max(...velocityPoints.map((point) => point.y))
  const velocitySpan = Math.max(Math.abs(velocityMin), Math.abs(velocityMax), 2)
  const velocityTicks = buildTicks(velocitySpan * 2, 4).map((tick) => Number((tick - velocitySpan).toFixed(2)))
  const rows = Array.from({ length: 9 }, (_, index) => {
    const t = (flightTime * index) / 8
    const y = Math.max(0, height0 + (vy0 * t) - ((gravity * t ** 2) / 2))
    const vy = vy0 - (gravity * t)

    return {
      t,
      x: vx * t,
      y,
      vy,
      ay: -gravity,
      speed: Math.sqrt((vx ** 2) + (vy ** 2)),
    }
  })

  return (
    <div className="rounded-[2.2rem] border border-ink/10 bg-white/78 p-5 shadow-[0_28px_70px_rgba(18,23,35,0.08)] md:p-8">
      <div className="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-4">
          <LabCard title="Controles del modelo" className="bg-paper">
            <h3 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em]">Trayectoria y cálculo</h3>
            <p className="mt-3 text-sm leading-6 text-ink/68">Ajusta el lanzamiento, mueve el tiempo y observa cómo cambian la trayectoria, la derivada y la segunda derivada.</p>
          </LabCard>

          <LabCard title="Problema modelado">
            <p className="mt-3 text-sm leading-6 text-ink/68">Se modela el lanzamiento idealizado de una pelota desde una altura inicial. La posición vertical sigue una trayectoria parabólica y se analiza junto con su primera y segunda derivada.</p>
          </LabCard>

          <SliderField id="traj-speed" label="Velocidad inicial" value={speed} min={8} max={28} step={1} suffix=" m/s" onChange={setSpeed} />
          <SliderField id="traj-angle" label="Ángulo de salida" value={angle} min={25} max={78} step={1} suffix="°" onChange={setAngle} />
          <SliderField id="traj-height" label="Altura inicial" value={height0} min={0} max={5} step={0.5} suffix=" m" onChange={setHeight0} />
          <SliderField id="traj-gravity" label="Gravedad" value={gravity} min={4} max={12} step={0.2} suffix=" m/s²" onChange={setGravity} />
          <SliderField id="traj-time" label="Tiempo leído" value={currentTime} min={0} max={flightTime} step={Math.max(flightTime / 180, 0.01)} suffix=" s" onChange={setTime} />
        </div>

        <div className="space-y-5">
          <LabCard dark className="rounded-[1.9rem] shadow-[0_22px_65px_rgba(18,23,35,0.18)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-paper/45">Escena sincronizada</p>
                <h3 className="mt-3 font-display text-3xl">Movimiento, gráfica y lectura matemática a la vez</h3>
              </div>
              <span className="rounded-full border border-graph/30 bg-graph/12 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-graph">
                {Math.abs(current.vy) < 0.2 ? 'Punto crítico' : current.vy > 0 ? 'Ascenso' : 'Descenso'}
              </span>
            </div>

            <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/6 p-4">
              <CartesianFrame
                xMin={0}
                xMax={sceneXMax}
                yMin={0}
                yMax={sceneYMax}
                xTicks={buildTicks(sceneXMax)}
                yTicks={buildTicks(sceneYMax)}
                xLabel="x (m)"
                yLabel="y (m)"
                className="w-full h-auto overflow-visible rounded-[1.3rem]"
              >
                {({ scaleX, scaleY }) => (
                  <>
                    <path d={linePath(motionPoints, scaleX, scaleY)} fill="none" stroke="rgba(199,244,100,0.92)" strokeWidth="5" strokeLinecap="round" />
                    <circle cx={scaleX(peak.x)} cy={scaleY(peak.y)} r="6" fill="rgba(199,244,100,0.95)" />
                    <circle cx={scaleX(current.x)} cy={scaleY(current.y)} r="8" fill="rgba(255,107,53,1)" stroke="rgba(255,255,255,0.85)" strokeWidth="3" />
                  </>
                )}
              </CartesianFrame>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MetricCard label="Altura y(t)" value={`${format(current.y)} m`} detail="Función de posición vertical." />
              <MetricCard label="Velocidad v(t)" value={`${format(current.vy)} m/s`} detail="Derivada de la altura respecto al tiempo." />
              <MetricCard label="Aceleración a(t)" value={`${format(current.ay)} m/s²`} detail="Segunda derivada constante." />
              <MetricCard label="Desplazamiento x(t)" value={`${format(current.x)} m`} detail="Componente horizontal del movimiento." />
            </div>
          </LabCard>

          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            <LabCard title="Altura" className="bg-gradient-to-br from-white via-paper/70 to-white">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl tracking-[-0.03em] text-ink">h(t)</p>
                  <p className="mt-1 text-sm leading-6 text-ink/62">La posición vertical sube hasta un máximo y luego desciende.</p>
                </div>
                <span className="rounded-full border border-signal/18 bg-signal/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-signal">
                  Posición
                </span>
              </div>
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{`h(t) = ${format(height0)} + ${format(vy0)}t - ${format(gravity / 2)}t²`}</p>
              </div>
              <div className="mt-4 rounded-[1.45rem] border border-ink/8 bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <CartesianFrame
                  xMin={0}
                  xMax={flightTime}
                  yMin={0}
                  yMax={Math.max(peak.y * 1.15, 4)}
                  dark={false}
                  xTicks={timeTicks}
                  yTicks={heightTicks}
                  xLabel="t (s)"
                  yLabel="h(t) (m)"
                  className="w-full h-auto aspect-[6/5] overflow-visible rounded-[1rem]"
                >
                  {({ scaleX, scaleY, height, padding }) => (
                    <>
                      <path d={`${linePath(heightPoints, scaleX, scaleY)} L ${scaleX(flightTime)} ${height - padding} L ${scaleX(0)} ${height - padding} Z`} fill="rgba(199,244,100,0.14)" />
                      <line x1={scaleX(currentTime)} y1={height - padding} x2={scaleX(currentTime)} y2={scaleY(current.y)} stroke="rgba(255,107,53,0.4)" strokeDasharray="5 5" strokeWidth="1.5" />
                      <line x1={scaleX(0)} y1={scaleY(current.y)} x2={scaleX(currentTime)} y2={scaleY(current.y)} stroke="rgba(255,107,53,0.3)" strokeDasharray="5 5" strokeWidth="1.5" />
                      <path d={linePath(heightPoints, scaleX, scaleY)} fill="none" stroke="rgba(18,23,35,0.94)" strokeWidth="4.5" strokeLinecap="round" />
                      <circle cx={scaleX(peakTime)} cy={scaleY(peak.y)} r="5.5" fill="rgba(199,244,100,0.98)" stroke="rgba(18,23,35,0.65)" strokeWidth="1.8" />
                      <circle cx={scaleX(currentTime)} cy={scaleY(current.y)} r="6.5" fill="rgba(255,107,53,1)" stroke="white" strokeWidth="2.5" />
                    </>
                  )}
                </CartesianFrame>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/62">El punto naranja marca el instante leído y el punto verde el máximo de la trayectoria.</p>
            </LabCard>

            <LabCard title="Derivada" className="bg-gradient-to-br from-white via-[#eef7f6] to-white">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl tracking-[-0.03em] text-ink">v(t)</p>
                  <p className="mt-1 text-sm leading-6 text-ink/62">La pendiente de h(t) cambia linealmente y se anula en el punto más alto.</p>
                </div>
                <span className="rounded-full border border-aqua/18 bg-aqua/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[#1f7a78]">
                  Derivada
                </span>
              </div>
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{`v(t) = ${format(vy0)} - ${format(gravity)}t`}</p>
              </div>
              <div className="mt-4 rounded-[1.45rem] border border-ink/8 bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <CartesianFrame
                  xMin={0}
                  xMax={flightTime}
                  yMin={-velocitySpan * 1.15}
                  yMax={velocitySpan * 1.15}
                  dark={false}
                  xTicks={timeTicks}
                  yTicks={velocityTicks}
                  xLabel="t (s)"
                  yLabel="v(t) (m/s)"
                  className="w-full h-auto aspect-[6/5] overflow-visible rounded-[1rem]"
                >
                  {({ scaleX, scaleY, padding, width }) => (
                    <>
                      <line x1={padding} y1={scaleY(0)} x2={width - padding} y2={scaleY(0)} stroke="rgba(18,23,35,0.34)" strokeWidth="2.4" />
                      <line x1={scaleX(currentTime)} y1={scaleY(0)} x2={scaleX(currentTime)} y2={scaleY(current.vy)} stroke="rgba(255,107,53,0.4)" strokeDasharray="5 5" strokeWidth="1.5" />
                      <path d={linePath(velocityPoints, scaleX, scaleY)} fill="none" stroke="rgba(31,122,120,0.98)" strokeWidth="4.6" strokeLinecap="round" />
                      <circle cx={scaleX(peakTime)} cy={scaleY(0)} r="5.5" fill="rgba(199,244,100,0.98)" stroke="rgba(18,23,35,0.6)" strokeWidth="1.8" />
                      <circle cx={scaleX(currentTime)} cy={scaleY(current.vy)} r="6.5" fill="rgba(255,107,53,1)" stroke="white" strokeWidth="2.5" />
                    </>
                  )}
                </CartesianFrame>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/62">Cuando v(t) cruza 0, la altura alcanza su extremo máximo.</p>
            </LabCard>

            <LabCard title="Segunda derivada" className="bg-gradient-to-br from-white via-[#eefbfa] to-white">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl tracking-[-0.03em] text-ink">a(t)</p>
                  <p className="mt-1 text-sm leading-6 text-ink/62">La aceleración permanece constante y negativa durante todo el movimiento.</p>
                </div>
                <span className="rounded-full border border-aqua/18 bg-aqua/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-aqua">
                  Constante
                </span>
              </div>
              <div className="overflow-x-auto rounded-[1.2rem] bg-paper px-4 py-4">
                <p className="min-w-max whitespace-nowrap font-mono text-[1rem] font-semibold text-ink md:text-[1.08rem]">{`a(t) = -${format(gravity)}`}</p>
              </div>
              <div className="mt-4 rounded-[1.45rem] border border-ink/8 bg-white px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <CartesianFrame
                  xMin={0}
                  xMax={flightTime}
                  yMin={-gravity * 1.4}
                  yMax={1}
                  dark={false}
                  xTicks={timeTicks}
                  yTicks={[-gravity * 1.2, -gravity, -gravity * 0.8, 0].map((tick) => Number(tick.toFixed(2)))}
                  xLabel="t (s)"
                  yLabel="a(t) (m/s²)"
                  className="w-full h-auto aspect-[6/5] overflow-visible rounded-[1rem]"
                >
                  {({ scaleX, scaleY, padding, width }) => (
                    <>
                      <line x1={padding} y1={scaleY(-gravity)} x2={width - padding} y2={scaleY(-gravity)} stroke="rgba(84,214,201,0.2)" strokeWidth="8" strokeLinecap="round" />
                      <line x1={scaleX(currentTime)} y1={scaleY(0)} x2={scaleX(currentTime)} y2={scaleY(-gravity)} stroke="rgba(255,107,53,0.4)" strokeDasharray="5 5" strokeWidth="1.5" />
                      <path d={linePath(accelPoints, scaleX, scaleY)} fill="none" stroke="rgba(84,214,201,0.98)" strokeWidth="4.8" strokeLinecap="round" />
                      <circle cx={scaleX(currentTime)} cy={scaleY(-gravity)} r="6.5" fill="rgba(255,107,53,1)" stroke="white" strokeWidth="2.5" />
                    </>
                  )}
                </CartesianFrame>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/62">La segunda derivada fija la concavidad de h(t) y explica por qué la parábola abre hacia abajo.</p>
            </LabCard>
          </div>

          <LabCard title="Datos del movimiento">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-6 text-ink/68">Descarga una muestra de tiempo, posición, velocidad y aceleración para continuar el análisis fuera del laboratorio.</p>
              <button
                type="button"
                onClick={() => downloadCsv([
                  ['t', 'x', 'y', 'v_y', 'a_y', '|v|'],
                  ...rows.map((row) => [format(row.t), format(row.x), format(row.y), format(row.vy), format(row.ay), format(row.speed)]),
                ], 'trayectoria-y-calculo-datos.csv')}
                className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-semibold text-white"
              >
                Descargar CSV
              </button>
            </div>
          </LabCard>
        </div>
      </div>
    </div>
  )
}
