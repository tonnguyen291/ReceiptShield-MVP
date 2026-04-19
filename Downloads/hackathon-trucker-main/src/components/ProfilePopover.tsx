import { EditIcon, LogoutIcon } from './icons/AppIcons'
import { useNotice } from '../context/NoticeToastContext'

export function ProfilePopover({ onClose }: { onClose: () => void }) {
  const { showNotice } = useNotice()

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-30"
        onClick={onClose}
        aria-label="Close profile menu"
        style={{ background: 'transparent', border: 'none', cursor: 'default' }}
      />
      <div className="absolute top-[52px] right-4 z-40 grid w-[280px] justify-items-center rounded-[10px] bg-white px-0 pt-6 pb-[10px] text-[#465676] shadow-[0_12px_28px_rgba(51,63,92,0.22)]">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-[#9e9af0] text-[14px] font-bold text-white">
          TS
        </div>
        <strong className="mt-3 text-[16px] font-bold text-[#2e3644]">Trailer Swift ASU</strong>
        <span className="mt-1 text-[13px] text-[#6d7686]">Trailer Swift</span>
        <div className="my-[14px] mb-[6px] h-px w-full bg-[#ebeff7]" />
        <button
          type="button"
          onClick={() => showNotice('Edit Profile feature coming in full release.')}
          className="flex w-full items-center gap-3 px-[22px] py-[10px] text-[14px] font-semibold text-[#66759a] hover:bg-[#f5f7fb]"
        >
          <EditIcon />
          <span>Edit Profile</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            showNotice('You have been logged out (demo).')
          }}
          className="flex w-full items-center gap-3 px-[22px] py-[10px] text-[14px] font-semibold text-[#66759a] hover:bg-[#f5f7fb]"
        >
          <LogoutIcon />
          <span>Log out</span>
        </button>
      </div>
    </>
  )
}
