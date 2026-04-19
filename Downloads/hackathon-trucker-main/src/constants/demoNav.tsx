/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react'
import {
  ChartIcon,
  GlobeIcon,
  HelpIcon,
  LiveQueueIcon,
  MapPaneIcon,
  PhoneIcon,
  RiskManagementIcon,
  SupportIcon,
  TrainingIcon,
} from '../components/icons/AppIcons'

export type MainTab = 'Map' | 'Risk Management' | 'Reports' | 'Live Priority Queue'

export type TabItem = {
  icon: ReactNode
  label: MainTab
}

export type UtilityItem = {
  icon: ReactNode
  label: string
}

export const MAIN_TABS: TabItem[] = [
  { icon: <GlobeIcon />, label: 'Map' },
  { icon: <RiskManagementIcon />, label: 'Risk Management' },
  { icon: <ChartIcon />, label: 'Reports' },
  { icon: <LiveQueueIcon />, label: 'Live Priority Queue' },
]

export const UTILITY_ITEMS: UtilityItem[] = [
  { icon: <PhoneIcon />, label: 'Download Driver App' },
  { icon: <TrainingIcon />, label: 'Book Training' },
  { icon: <HelpIcon />, label: 'Help Center' },
  { icon: <SupportIcon />, label: 'Support' },
]

export { LiveQueueIcon, MapPaneIcon, RiskManagementIcon }
