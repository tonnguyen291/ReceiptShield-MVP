import type { PriorityStatus } from './priorityTypes'

export const STATUS_META: Record<
  PriorityStatus,
  { color: string; dotColor: string; label: string }
> = {
  CRITICAL: { color: '#e84040', dotColor: '#e84040', label: 'CRITICAL' },
  ALERT: { color: '#e8952a', dotColor: '#e8952a', label: 'ALERT' },
  SAFE: { color: '#22a559', dotColor: '#22a559', label: 'SAFE' },
}

export const TRAFFIC_LABEL: Record<string, string> = {
  light: 'Light traffic',
  moderate: 'Moderate traffic',
  heavy: 'Heavy traffic',
  'stop-and-go': 'Stop-and-go',
}

export const WEATHER_LABEL: Record<string, string> = {
  clear: 'Clear',
  windy: 'Windy',
  rain: 'Rain',
  fog: 'Fog',
  dust: 'Dust',
}
