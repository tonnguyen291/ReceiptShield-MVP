import { useState } from 'react'
import { LogoMark } from './components/LogoMark'
import { ProfilePopover } from './components/ProfilePopover'
import {
  ExpandIcon,
  GridIcon,
  MenuIcon,
  MessageIcon,
  WaypointIcon,
} from './components/icons/AppIcons'
import {
  LiveQueueIcon as SidebarQueueIcon,
  MAIN_TABS,
  MapPaneIcon as SidebarMapIcon,
  RiskManagementIcon as SidebarRiskIcon,
  UTILITY_ITEMS,
  type MainTab,
} from './constants/demoNav'
import { useNotice } from './context/NoticeToastContext'
import { ROADMAP_NOTICE } from './lib/roadmap'
import { LivePriorityQueueScreen } from './screens/liveQueue/LivePriorityQueueScreen'
import { MapScreen } from './screens/MapScreen'
import { RiskManagementScreen } from './screens/risk/RiskManagementScreen'
import { ReportsScreen } from './screens/ReportsScreen'

const topNavButtonClass =
  'grid place-items-center p-0 text-[20px] text-[#5f6d8d] transition-colors hover:text-[#2f3850]'

export default function App() {
  const { showNotice } = useNotice()
  const [activeTab, setActiveTab] = useState<MainTab>('Map')
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [driverDetailId, setDriverDetailId] = useState<string | null>(null)

  function navigateToDriver(id: string) {
    setDriverDetailId(id)
    setActiveTab('Live Priority Queue')
  }

  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#f4f6fa] text-[#2f3850]">
      <header className="z-30 flex h-14 items-center justify-between border-b border-[#ebeff7] bg-white px-[18px] pl-5">
        <div className="flex h-full items-stretch gap-8">
          <button
            type="button"
            className="my-auto hidden h-10 w-10 place-items-center rounded-[8px] text-[22px] text-[#4f5c73] max-[860px]:grid"
            onClick={() => setMobileMenuOpen((value) => !value)}
            aria-label="Toggle menu"
          >
            <MenuIcon />
          </button>
          <LogoMark />
          <nav className="flex h-full items-stretch gap-[6px] max-[860px]:hidden" aria-label="Primary">
            {MAIN_TABS.map((tab) => {
              const isActive = activeTab === tab.label
              return (
                <button
                  key={tab.label}
                  type="button"
                  className={`relative inline-flex h-full items-center gap-2 px-[14px] text-[14px] font-semibold ${
                    isActive ? 'text-[#2f6fe0]' : 'text-[#6b7794]'
                  }`}
                  onClick={() => {
                    setActiveTab(tab.label)
                    setMobileMenuOpen(false)
                  }}
                >
                  <span className="text-[20px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {isActive ? (
                    <span className="absolute right-[14px] bottom-0 left-[14px] h-[3px] rounded-tl-[3px] rounded-tr-[3px] bg-[#2f6fe0]" />
                  ) : null}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-[18px] text-[#5f6d8d]">
          <button
            type="button"
            onClick={() => showNotice(ROADMAP_NOTICE)}
            className={topNavButtonClass}
            aria-label="Locations"
          >
            <WaypointIcon />
          </button>
          <button
            type="button"
            onClick={() => showNotice(ROADMAP_NOTICE)}
            className={topNavButtonClass}
            aria-label="Messages"
          >
            <MessageIcon />
          </button>
          <button
            type="button"
            onClick={() => showNotice(ROADMAP_NOTICE)}
            className={topNavButtonClass}
            aria-label="Apps"
          >
            <GridIcon />
          </button>
          <button
            type="button"
            className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#a5a1f3] text-[11px] font-bold text-white"
            onClick={() => setProfileOpen((value) => !value)}
            aria-label="Account"
          >
            <span>TS</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={`relative z-20 flex flex-col border-r border-[#ebeff7] bg-white pt-2.5 transition-[width] duration-200 ease-in-out overflow-hidden max-[860px]:absolute max-[860px]:top-0 max-[860px]:bottom-0 max-[860px]:left-0 max-[860px]:shadow-[8px_0_24px_rgba(71,83,111,0.18)] max-[860px]:transition-transform max-[860px]:duration-200 max-[860px]:ease-in-out ${
            sidebarExpanded ? 'w-52 items-stretch' : 'w-14 items-center'
          } ${mobileMenuOpen ? 'max-[860px]:translate-x-0' : 'max-[860px]:-translate-x-full'}`}
        >
          <button
            type="button"
            className={`mx-2 flex items-center gap-3 rounded-[8px] px-2 py-2.5 text-[14px] font-semibold transition-colors ${
              activeTab === 'Map' ? 'bg-[#e6efff] text-[#2f6fe0]' : 'text-[#8a99b8] hover:bg-[#f3f6fb] hover:text-[#4f5c73]'
            }`}
            onClick={() => {
              setActiveTab('Map')
              setMobileMenuOpen(false)
            }}
            aria-label="Map"
          >
            <span className="shrink-0 text-[22px]">
              <SidebarMapIcon />
            </span>
            <span
              className={`whitespace-nowrap transition-opacity duration-150 ${
                sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              Map
            </span>
          </button>

          <button
            type="button"
            className={`mx-2 flex items-center gap-3 rounded-[8px] px-2 py-2.5 text-[14px] font-semibold transition-colors ${
              activeTab === 'Risk Management'
                ? 'bg-[#e6efff] text-[#2f6fe0]'
                : 'text-[#8a99b8] hover:bg-[#f3f6fb] hover:text-[#4f5c73]'
            }`}
            onClick={() => {
              setActiveTab('Risk Management')
              setMobileMenuOpen(false)
            }}
            aria-label="Risk Management"
          >
            <span className="relative shrink-0 text-[22px]">
              <SidebarRiskIcon />
              <span className="absolute -top-[2px] -right-[2px] h-[6px] w-[6px] rounded-full bg-[#e8952a]" />
            </span>
            <span
              className={`whitespace-nowrap transition-opacity duration-150 ${
                sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              Risk Management
            </span>
          </button>

          <button
            type="button"
            className={`mx-2 flex items-center gap-3 rounded-[8px] px-2 py-2.5 text-[14px] font-semibold transition-colors ${
              activeTab === 'Live Priority Queue'
                ? 'bg-[#e6efff] text-[#2f6fe0]'
                : 'text-[#8a99b8] hover:bg-[#f3f6fb] hover:text-[#4f5c73]'
            }`}
            onClick={() => {
              setActiveTab('Live Priority Queue')
              setMobileMenuOpen(false)
            }}
            aria-label="Live Priority Queue"
          >
            <span className="relative shrink-0 text-[22px]">
              <SidebarQueueIcon />
              <span className="absolute -top-[3px] -right-[3px] h-[7px] w-[7px] rounded-full bg-[#e84040]" />
            </span>
            <span
              className={`whitespace-nowrap transition-opacity duration-150 ${
                sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              Live Priority Queue
            </span>
          </button>

          <div className="flex-1" />

          <div className="mb-[6px] flex flex-col gap-[2px]">
            {UTILITY_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => showNotice(ROADMAP_NOTICE)}
                className="mx-2 flex items-center gap-3 rounded-[8px] px-2 py-2.5 text-[13px] text-[#8a99b8] transition-colors hover:bg-[#f3f6fb] hover:text-[#4f5c73]"
              >
                <span className="shrink-0 text-[20px]">{item.icon}</span>
                <span
                  className={`whitespace-nowrap transition-opacity duration-150 ${
                    sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="mx-2 mb-[10px] flex items-center gap-3 rounded-[8px] px-2 py-2.5 text-[13px] font-semibold text-[#2f6fe0] transition-colors hover:bg-[#e6efff]"
            onClick={() => setSidebarExpanded((v) => !v)}
          >
            <span
              className={`shrink-0 text-[22px] transition-transform duration-200 ${sidebarExpanded ? 'rotate-180' : ''}`}
            >
              <ExpandIcon />
            </span>
            <span
              className={`whitespace-nowrap transition-opacity duration-150 ${
                sidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              Collapse Menu
            </span>
          </button>
        </aside>

        <section className="relative flex min-w-0 flex-1 overflow-hidden bg-[#eef2f8]">
          {activeTab === 'Map' ? (
            <MapScreen onDriverNavigate={navigateToDriver} />
          ) : activeTab === 'Risk Management' ? (
            <RiskManagementScreen />
          ) : activeTab === 'Reports' ? (
            <ReportsScreen />
          ) : (
            <LivePriorityQueueScreen
              initialSelectedId={driverDetailId}
              onDetailClosed={() => setDriverDetailId(null)}
            />
          )}
        </section>
      </div>

      {mobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 top-14 bottom-0 z-[15] border-0 bg-[rgba(30,40,60,0.35)]"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      ) : null}

      {profileOpen ? <ProfilePopover onClose={() => setProfileOpen(false)} /> : null}
    </main>
  )
}
