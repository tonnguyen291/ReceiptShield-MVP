import { useState } from 'react'
import {
  CalendarIcon,
  ChatIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClearIcon,
  DocumentSearchIcon,
  DoubleChevronLeftIcon,
  DoubleChevronRightIcon,
  MetricIcon,
  OpenIcon,
  PrintIcon,
  SortIcon,
} from '../components/icons/AppIcons'
import {
  REPORT_COLUMNS,
  REPORT_FILTERS,
  REPORT_SORTABLE_COLUMNS,
} from '../constants/demoReport'
import { useNotice } from '../context/NoticeToastContext'
import { ROADMAP_NOTICE } from '../lib/roadmap'

const reportIconButtonClass =
  'grid h-8 w-8 place-items-center rounded-[6px] border border-[#dfe5f0] bg-white text-[16px] text-[#2f6fe0]'

const pageButtonClass =
  'grid h-7 w-7 place-items-center rounded-[6px] border border-[#dfe5f0] bg-white text-[12px] text-[#93a4c4]'

export function ReportsScreen() {
  const { showNotice } = useNotice()
  const [searchActive] = useState(true)

  return (
    <div className="relative flex flex-1 flex-col overflow-auto bg-[#fbfcfe]">
      <div className="flex h-16 items-center border-b border-[#ebeff7] bg-white px-6">
        <h1 className="m-0 text-[20px] font-bold text-[#313745]">Driver Performance Report</h1>
      </div>

      <div className="flex items-start justify-between gap-5 border-b border-[#ebeff7] bg-white px-6 pt-[14px] pb-4">
        <div className="flex flex-wrap gap-[10px]">
          {REPORT_FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => showNotice(ROADMAP_NOTICE)}
              className={`inline-flex h-9 items-center justify-between gap-[10px] rounded-[6px] border border-[#d5dceb] bg-white px-3 ${
                filter.wide ? 'min-w-[230px]' : filter.metric ? 'min-w-[200px]' : 'min-w-[158px]'
              }`}
            >
              <span className="text-[12px] text-[#9aa5ba]">{filter.label}</span>
              <strong className="text-[13px] font-semibold text-[#354056]">{filter.value}</strong>
              <span className={filter.metric ? 'text-[#354056]' : 'text-[#7d89a4]'}>
                {filter.metric ? (
                  <MetricIcon />
                ) : filter.label === 'Date' ? (
                  <CalendarIcon />
                ) : (
                  <ChevronDownIcon />
                )}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => showNotice(ROADMAP_NOTICE)}
            className="inline-flex h-9 items-center gap-[10px] px-3 text-[12px] font-bold text-[#b0b8c7]"
          >
            <ClearIcon />
            <span>CLEAR ALL</span>
          </button>
        </div>

        <div className="flex items-center gap-[10px] text-[#2f6fe0]">
          <button type="button" onClick={() => showNotice(ROADMAP_NOTICE)} className={reportIconButtonClass} aria-label="Open">
            <OpenIcon />
          </button>
          <button type="button" onClick={() => showNotice(ROADMAP_NOTICE)} className={reportIconButtonClass} aria-label="Print">
            <PrintIcon />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pt-[14px] pb-[14px]">
        <div className="grid min-h-[42px] grid-cols-[1.25fr_1.2fr_1fr_0.7fr_1fr_0.9fr_1fr_0.8fr] rounded-t-[8px] border border-b-0 border-[#ebeff7] bg-[#f1f4fa]">
          {REPORT_COLUMNS.map((column) => (
            <div key={column} className="flex items-center gap-1 px-4 text-[13px] font-semibold text-[#96a1b6]">
              <span>{column}</span>
              {(REPORT_SORTABLE_COLUMNS as readonly string[]).includes(column) ? (
                <span className="text-[12px] text-[#c6cfdd]">
                  <SortIcon />
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {searchActive ? (
          <div className="flex-1 border border-[#ebeff7] bg-white">
            <div className="grid grid-cols-[1.25fr_1.2fr_1fr_0.7fr_1fr_0.9fr_1fr_0.8fr] gap-0 border-b border-[#ebeff7] text-[13px] text-[#4f5c73] transition-colors hover:bg-[#f8fafd]">
              <div className="flex items-center px-4 py-3 font-semibold text-[#2f6fe0]">James Wilson</div>
              <div className="flex items-center px-4 py-3">Apr 19, 2026 09:42</div>
              <div className="flex items-center px-4 py-3">PHX</div>
              <div className="flex items-center px-4 py-3">14</div>
              <div className="flex items-center px-4 py-3">4,203</div>
              <div className="flex items-center px-4 py-3">12</div>
              <div className="flex items-center px-4 py-3">42</div>
              <div className="flex items-center px-4 py-3">2</div>
            </div>
            <div className="grid grid-cols-[1.25fr_1.2fr_1fr_0.7fr_1fr_0.9fr_1fr_0.8fr] gap-0 border-b border-[#ebeff7] text-[13px] text-[#4f5c73] transition-colors hover:bg-[#f8fafd]">
              <div className="flex items-center px-4 py-3 font-semibold text-[#2f6fe0]">Marcus Johnson</div>
              <div className="flex items-center px-4 py-3">Apr 19, 2026 08:15</div>
              <div className="flex items-center px-4 py-3">TUS</div>
              <div className="flex items-center px-4 py-3">22</div>
              <div className="flex items-center px-4 py-3">5,810</div>
              <div className="flex items-center px-4 py-3">105</div>
              <div className="flex items-center px-4 py-3">8</div>
              <div className="flex items-center px-4 py-3">5</div>
            </div>
            <div className="grid grid-cols-[1.25fr_1.2fr_1fr_0.7fr_1fr_0.9fr_1fr_0.8fr] gap-0 border-b border-[#ebeff7] text-[13px] text-[#4f5c73] transition-colors hover:bg-[#f8fafd]">
              <div className="flex items-center px-4 py-3 font-semibold text-[#2f6fe0]">Sarah Miller</div>
              <div className="flex items-center px-4 py-3">Apr 19, 2026 07:30</div>
              <div className="flex items-center px-4 py-3">DEN</div>
              <div className="flex items-center px-4 py-3">18</div>
              <div className="flex items-center px-4 py-3">5,115</div>
              <div className="flex items-center px-4 py-3">0</div>
              <div className="flex items-center px-4 py-3">15</div>
              <div className="flex items-center px-4 py-3">0</div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-[300px] flex-1 place-items-center gap-[14px] border border-[#ebeff7] bg-white text-center text-[#9aa8c0]">
            <div className="grid place-items-center text-[64px] text-[#d2d8e4]">
              <DocumentSearchIcon />
            </div>
            <p className="m-0 text-[13px] leading-[1.4]">No results matched this search.</p>
          </div>
        )}

        <div className="flex h-[60px] items-center justify-center gap-7 rounded-b-[8px] border border-t-0 border-[#ebeff7] bg-white">
          <div className="flex items-center gap-[10px] text-[13px] font-semibold text-[#344057]">
            <button type="button" onClick={() => showNotice(ROADMAP_NOTICE)} className={pageButtonClass}>
              <DoubleChevronLeftIcon />
            </button>
            <button type="button" onClick={() => showNotice(ROADMAP_NOTICE)} className={pageButtonClass}>
              <ChevronLeftIcon />
            </button>
            <strong>1 of 1</strong>
            <button type="button" onClick={() => showNotice(ROADMAP_NOTICE)} className={pageButtonClass}>
              <ChevronRightIcon />
            </button>
            <button type="button" onClick={() => showNotice(ROADMAP_NOTICE)} className={pageButtonClass}>
              <DoubleChevronRightIcon />
            </button>
          </div>

          <div className="flex items-center gap-[10px] text-[13px] font-semibold text-[#4f628a]">
            <span>Show rows</span>
            <button
              type="button"
              onClick={() => showNotice(ROADMAP_NOTICE)}
              className="inline-flex h-9 min-w-[70px] items-center justify-between gap-[10px] rounded-[6px] border border-[#d5dceb] bg-white px-3 font-semibold text-[#2f6fe0]"
            >
              <span>20</span>
              <ChevronDownIcon />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => showNotice(ROADMAP_NOTICE)}
        className="absolute right-[22px] bottom-6 z-[500] grid h-14 w-14 place-items-center rounded-full bg-[#2f6fe0] text-[26px] text-white shadow-[0_10px_22px_rgba(47,111,224,0.35)]"
        aria-label="Chat"
      >
        <ChatIcon />
      </button>
    </div>
  )
}
