import Link from 'next/link';
import Script from 'next/script';

interface LayoutProps {
  children?: React.ReactNode;
}

const navLinks = [
  { label: 'ダッシュボード', href: '/dashboard' },
  { label: '利用状況', href: '/dashboard/usage' },
  { label: 'プラン', href: '/dashboard/plans' },
];

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#010e0a] via-[#020d12] to-[#010306] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-[-30%] top-[-20%] h-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(74,240,171,0.22),transparent_65%)] blur-[160px]" />
        <div className="absolute bottom-[-35%] left-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(28,157,116,0.28),transparent_70%)] blur-[180px]" />
        <div className="absolute right-[-5%] top-1/3 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_center,rgba(57,255,177,0.18),transparent_55%)] blur-[160px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/5 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">WEBGPT</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <nav className="flex flex-1 items-center justify-center gap-1 rounded-full border border-white/10 bg-emerald-950/30 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_20px_60px_rgba(6,20,11,0.65)] backdrop-blur-md">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex flex-1 justify-center rounded-full px-5 py-2 text-sm font-medium text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 hover:bg白/5 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_25px_45px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            >
              コンソールを開く
            </Link>
          </div>
        </header>

        <main className="mt-10 flex flex-1 flex-col gap-6 pb-16">
          {children}
        </main>
      </div>
      <Script
        src="https://www.webgpt.tokyo/api/embed/script?site_id=fe8aba45-7a35-41a5-9e57-9fbb88224c03&v=20250209"
        strategy="afterInteractive"
      />
    </div>
  );
}
