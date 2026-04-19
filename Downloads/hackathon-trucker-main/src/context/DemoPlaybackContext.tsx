import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { getFleetPlaybackFrame, normalizePlaybackSecond } from '../mocks/driverMapPlayback'
import { simulationMeta } from '../mocks/driverRiskSimulation'

/** Wall-clock delay between advancing one demo simulation step (Map, Live Queue, Risk). */
export const DEMO_PLAYBACK_TICK_MS = 5000

export type DemoPlaybackContextValue = {
  playbackSecond: number
  setPlaybackSecond: Dispatch<SetStateAction<number>>
  normalizedSecond: number
  isPlaying: boolean
  setIsPlaying: Dispatch<SetStateAction<boolean>>
  /** ISO timestamp for the current demo frame (fleet map / queue). */
  playbackTimestamp: string
}

const DemoPlaybackContext = createContext<DemoPlaybackContextValue | null>(null)

export function DemoPlaybackProvider({ children }: { children: ReactNode }) {
  const [playbackSecond, setPlaybackSecond] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => {
      setPlaybackSecond((s) => (s + 1) % simulationMeta.playbackSeconds)
    }, DEMO_PLAYBACK_TICK_MS)
    return () => window.clearInterval(id)
  }, [isPlaying])

  const normalizedSecond = useMemo(() => normalizePlaybackSecond(playbackSecond), [playbackSecond])
  const playbackTimestamp = useMemo(
    () => getFleetPlaybackFrame(normalizedSecond).timestamp,
    [normalizedSecond],
  )

  const value = useMemo<DemoPlaybackContextValue>(
    () => ({
      playbackSecond,
      setPlaybackSecond,
      normalizedSecond,
      isPlaying,
      setIsPlaying,
      playbackTimestamp,
    }),
    [playbackSecond, normalizedSecond, isPlaying, playbackTimestamp],
  )

  return <DemoPlaybackContext.Provider value={value}>{children}</DemoPlaybackContext.Provider>
}

export function useDemoPlayback(): DemoPlaybackContextValue {
  const ctx = useContext(DemoPlaybackContext)
  if (!ctx) {
    throw new Error('useDemoPlayback must be used within DemoPlaybackProvider')
  }
  return ctx
}
