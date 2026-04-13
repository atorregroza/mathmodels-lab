import { useState, useCallback } from 'react'

/**
 * Manages axis range state with lab defaults + user overrides.
 * When no override is active, output tracks the changing defaults.
 * When the user overrides, the value sticks until reset.
 */
export const useAxisRange = (defaults) => {
  const [overrides, setOverrides] = useState({
    xMin: null, xMax: null, yMin: null, yMax: null,
  })

  const xMin = overrides.xMin !== null ? overrides.xMin : defaults.xMin
  const xMax = overrides.xMax !== null ? overrides.xMax : defaults.xMax
  const yMin = overrides.yMin !== null ? overrides.yMin : defaults.yMin
  const yMax = overrides.yMax !== null ? overrides.yMax : defaults.yMax

  const isOverridden =
    overrides.xMin !== null || overrides.xMax !== null ||
    overrides.yMin !== null || overrides.yMax !== null

  const setRange = useCallback((key, value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return
    setOverrides((prev) => ({ ...prev, [key]: num }))
  }, [])

  const resetRange = useCallback(() => {
    setOverrides({ xMin: null, xMax: null, yMin: null, yMax: null })
  }, [])

  return { xMin, xMax, yMin, yMax, setRange, resetRange, isOverridden }
}
