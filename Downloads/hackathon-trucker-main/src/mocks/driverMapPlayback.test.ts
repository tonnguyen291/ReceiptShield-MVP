import { describe, expect, it } from 'vitest'
import {
  getFleetPlaybackFrame,
  getPlaybackDriverProfiles,
  normalizePlaybackSecond,
} from './driverMapPlayback'
import { simulationMeta } from './driverRiskSimulation'

describe('normalizePlaybackSecond', () => {
  it('clamps to valid playback range', () => {
    expect(normalizePlaybackSecond(-5)).toBe(0)
    expect(normalizePlaybackSecond(0)).toBe(0)
    expect(normalizePlaybackSecond(simulationMeta.playbackSeconds + 10)).toBe(
      simulationMeta.playbackSeconds - 1,
    )
  })
})

describe('getPlaybackDriverProfiles', () => {
  it('returns twelve drivers sorted by risk score descending', () => {
    const profiles = getPlaybackDriverProfiles(30)
    expect(profiles).toHaveLength(12)
    for (let i = 0; i < profiles.length - 1; i++) {
      expect(profiles[i].riskScore).toBeGreaterThanOrEqual(profiles[i + 1].riskScore)
    }
  })
})

describe('getFleetPlaybackFrame', () => {
  it('includes one playback state per simulated driver', () => {
    expect(getFleetPlaybackFrame(12).drivers).toHaveLength(12)
  })
})
