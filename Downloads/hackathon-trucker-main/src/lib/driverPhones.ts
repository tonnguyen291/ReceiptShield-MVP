const DRIVER_PHONES: Record<string, string> = {
  'driver-01': '602-555-0312',
  'driver-02': '602-555-0234',
  'driver-03': '602-555-0187',
  'driver-04': '602-555-0401',
  'driver-05': '602-555-0402',
  'driver-06': '602-555-0403',
  'driver-07': '602-555-0404',
  'driver-08': '602-555-0405',
  'driver-09': '602-555-0406',
  'driver-10': '602-555-0407',
  'driver-11': '602-555-0408',
  'driver-12': '602-555-0409',
}

export function getDriverPhone(driverId: string): string {
  return DRIVER_PHONES[driverId] ?? '602-555-0000'
}
