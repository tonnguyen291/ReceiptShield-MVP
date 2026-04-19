import type { ReactNode } from 'react'
import { LatLngMap } from './LatLngMap'
import type { DriverMarker, RoutePin } from './LatLngMap'
import { DEFAULT_ARIZONA_DRIVERS } from '../constants/demoDrivers'
import { useNotice } from '../context/NoticeToastContext'
import { ROADMAP_NOTICE } from '../lib/roadmap'
import {
  ChatIcon,
  InfoIcon,
  LayerIcon,
  MinusIcon,
  PlusIcon,
  TargetIcon,
} from './icons/AppIcons'

export type FleetMapPaneProps = {
  drivers?: DriverMarker[]
  routePath?: [number, number][]
  completedRoutePath?: [number, number][]
  remainingRoutePath?: [number, number][]
  startPin?: RoutePin
  endPin?: RoutePin
  onDriverClick?: (driverId: string) => void
  topControls?: ReactNode
  defaultCenter?: [number, number]
  defaultZoom?: number
}

export function FleetMapPane({
  drivers = DEFAULT_ARIZONA_DRIVERS,
  routePath,
  completedRoutePath,
  remainingRoutePath,
  startPin,
  endPin,
  onDriverClick,
  topControls,
  defaultCenter = [33.9, -111.7],
  defaultZoom = 7,
}: FleetMapPaneProps) {
  const { showNotice } = useNotice()

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden bg-[#e6edf5] max-[860px]:min-h-[60vh]">
      <LatLngMap
        fillViewport
        points={[]}
        drivers={drivers}
        routePath={routePath}
        completedRoutePath={completedRoutePath}
        remainingRoutePath={remainingRoutePath}
        startPin={startPin}
        endPin={endPin}
        onDriverClick={onDriverClick}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        className="absolute inset-0 h-full w-full"
      />

      {topControls ? (
        <div className="pointer-events-none absolute top-[14px] left-[14px] z-[400] max-w-[calc(100%-28px)]">
          <div className="pointer-events-auto">{topControls}</div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => showNotice(ROADMAP_NOTICE)}
        className="absolute top-[14px] right-[14px] z-[400] inline-flex h-[34px] items-center gap-2 rounded-[4px] bg-white px-[14px] text-[13px] font-semibold text-[#353f50] shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
      >
        <span className="text-[16px]">
          <LayerIcon />
        </span>
        <span>Map Layer</span>
      </button>

      <div className="absolute right-[10px] bottom-7 z-[400] flex flex-col items-center gap-[10px]">
        <button
          type="button"
          onClick={() => showNotice(ROADMAP_NOTICE)}
          className="grid h-[30px] w-[30px] place-items-center rounded-[2px] bg-white text-[16px] text-[#4a5773] shadow-[0_1px_4px_rgba(0,0,0,0.28)]"
        >
          <TargetIcon />
        </button>
        <div className="overflow-hidden rounded-[2px] shadow-[0_1px_4px_rgba(0,0,0,0.28)]">
          <button
            type="button"
            onClick={() => showNotice(ROADMAP_NOTICE)}
            className="grid h-[30px] w-[30px] place-items-center bg-white text-[16px] text-[#4a5773]"
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            onClick={() => showNotice(ROADMAP_NOTICE)}
            className="grid h-[30px] w-[30px] place-items-center border-t border-[#e4e8ef] bg-white text-[16px] text-[#4a5773]"
          >
            <MinusIcon />
          </button>
        </div>
        <button
          type="button"
          onClick={() => showNotice(ROADMAP_NOTICE)}
          className="grid h-[22px] w-[22px] place-items-center rounded-full bg-white text-[12px] text-[#4a5773] shadow-[0_1px_4px_rgba(0,0,0,0.28)]"
        >
          <InfoIcon />
        </button>
      </div>

      <button
        type="button"
        onClick={() => showNotice(ROADMAP_NOTICE)}
        className="absolute right-[22px] bottom-[22px] z-[500] grid h-14 w-14 place-items-center rounded-full bg-[#2f6fe0] text-[26px] text-white shadow-[0_10px_22px_rgba(47,111,224,0.35)]"
        aria-label="Chat"
      >
        <ChatIcon />
      </button>
    </div>
  )
}
