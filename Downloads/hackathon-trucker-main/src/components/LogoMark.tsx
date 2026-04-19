export function LogoMark() {
  return (
    <div className="inline-flex self-center px-[2px]" aria-label="Trucker Path Fleets">
      <div className="inline-flex items-center gap-[10px]">
        <div
          className="grid h-7 w-7 grid-cols-2 gap-[3px] bg-[#2391d0] p-[5px]"
          aria-hidden="true"
        >
          <span className="border-[1.75px] border-white" />
          <span className="border-[1.75px] border-white" />
          <span className="border-[1.75px] border-white" />
          <span className="border-[1.75px] border-white" />
        </div>
        <div className="flex flex-col leading-[1.05] text-[#243a67]">
          <strong className="text-[10px] font-bold tracking-[0.04em]">TRUCKER PATH</strong>
          <span className="text-[17px] font-extrabold">FLEETS</span>
        </div>
      </div>
    </div>
  )
}
