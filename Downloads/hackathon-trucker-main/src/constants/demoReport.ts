export type RoutingStat = {
  label: string
  value: string
}

export type ReportFilter = {
  label: string
  value: string
  wide?: boolean
  metric?: boolean
}

export const ROUTING_STATS: RoutingStat[] = [
  { label: 'Length', value: '53ft 0in' },
  { label: 'Height', value: '13ft 6in' },
  { label: 'Weight', value: '80,000lbs' },
  { label: 'Axles', value: '3' },
  { label: 'Trailers', value: '1' },
]

export const REPORT_FILTERS: ReportFilter[] = [
  { label: 'Period', value: 'This Month' },
  { label: 'Date', value: 'Apr 01, 2026   -   Apr 18, 2026', wide: true },
  { label: 'Driver', value: 'Driver' },
  { label: 'Terminal', value: 'Terminal' },
  { label: 'Excess Mileage', value: 'mi', metric: true },
]

export const REPORT_COLUMNS = [
  'Driver',
  'Last Update Day/Time',
  'Terminal',
  'Trips',
  'Driving Miles',
  'OOR Miles',
  'Excess Mileage',
  'OOR Times',
] as const

export const REPORT_SORTABLE_COLUMNS = [
  'Trips',
  'Driving Miles',
  'OOR Miles',
  'Excess Mileage',
  'OOR Times',
] as const
