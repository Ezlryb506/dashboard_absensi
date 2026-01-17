/* eslint-disable @next/next/no-img-element */

export default function Header() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#00778a]/10 text-[#00778a]">
            <span className="material-symbols-outlined text-[24px]">school</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">UniMonitor</h2>
        </div>

        <div className="hidden items-center gap-8 text-sm font-medium md:flex">
          <a className="text-slate-500 transition-colors hover:text-[#00778a]" href="/">
            Monitor
          </a>
          <a className="text-slate-500 transition-colors hover:text-[#00778a]" href="/classes">
            Classes
          </a>
          <a className="text-slate-500 transition-colors hover:text-[#00778a]" href="/students">
            Students
          </a>
          <a className="text-slate-500 transition-colors hover:text-[#00778a]" href="#">
            Faculty
          </a>
          <a className="text-slate-500 transition-colors hover:text-[#00778a]" href="#">
            Reports
          </a>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden w-64 lg:flex">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
              search
            </span>
            <input
              className="w-full rounded-lg border-none bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-[#00778a]/20"
              placeholder="Quick find..."
              type="text"
            />
          </div>
          <button className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100">
            <span className="material-symbols-outlined text-[24px]">
              notifications
            </span>
            <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#f78359]" />
          </button>
          <div className="mx-1 h-8 w-px bg-slate-200" />
          <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-50">
            <div
              className="size-8 rounded-full bg-slate-200 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCgnONtxoMDdlULn8AL-20LMiKUV-P4CPn69c-_JdgE48alWAP268DjyFTASINVpJxpSD9Kcdx9bnB_HRuq0nyo-wjLHmNPb5V4R9SOrZB5-GBublZ50d5FjOY4WQxIaKhzmbosoxjLUOwpMv0AB0hl5NX2zdfzPkQCfjLC9w7do5YlFFINq4fG4c1J72_MHSocq5HERyAY7i2slhkjnt79dpA87-zFaYRjyXTrCc7muDU8BBkqC7m5T1aFXNC-bcouJmJeRxsidbi2')",
              }}
            />
            <span className="hidden text-sm font-semibold text-slate-700 xl:block">
              Admin User
            </span>
            <span className="material-symbols-outlined text-[20px] text-slate-400">
              expand_more
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
