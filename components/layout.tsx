import Link from 'next/link';

interface LayoutProps {
  children?: React.ReactNode;
}

const navLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Usage', href: '/dashboard/usage' },
  { label: 'Plans', href: '/dashboard/plans' },
];

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-[-20%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(20,233,86,0.35),transparent_60%)] blur-[120px]" />
        <div className="absolute bottom-[-40%] left-[-10%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.25),transparent_70%)] blur-[140px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/5 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-300/70">SiteGPT</p>
            <h1 className="text-2xl font-semibold text-white">Neon Operations Console</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <nav className="flex flex-1 items-center justify-center gap-1 rounded-full border border-emerald-400/20 bg-white/5 p-1 shadow-inner shadow-emerald-200/10">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex flex-1 justify-center rounded-full px-4 py-2 text-sm font-medium text-slate-200 transition hover:text-white hover:bg-emerald-400/10"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-300/30 transition hover:-translate-y-0.5"
            >
              Launch Console
            </Link>
          </div>
        </header>

        <main className="mt-10 flex flex-1 flex-col gap-6 pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
