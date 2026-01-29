import clsx from 'clsx';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/router';
import WebgptIcon from '@/components/WebgptIcon';

interface LayoutProps {
  children?: React.ReactNode;
  showShellHeader?: boolean;
  fullWidth?: boolean;
  darkMode?: boolean;
}

const navLinks = [
  { label: 'ダッシュボード', href: '/dashboard' },
  { label: '利用状況', href: '/dashboard/usage' },
  { label: 'プラン', href: '/dashboard/plans' },
];

export default function Layout({ children, showShellHeader = true, fullWidth = false, darkMode = false }: LayoutProps) {
  const router = useRouter();

  const mainContent = (
    <main className={clsx('flex flex-1 flex-col', fullWidth ? '' : 'gap-6 pb-16')}>
      {children}
    </main>
  );

  return (
    <div className={clsx('relative min-h-screen bg-premium-base text-premium-text', darkMode && 'theme-dark')}>
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_top,_rgba(122,244,193,0.25),_transparent_60%)] blur-3xl" />
        <div className="absolute -bottom-32 left-[-10%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_top,_rgba(25,195,125,0.25),_transparent_60%)] blur-3xl" />
        <div className="absolute inset-x-0 top-1/3 mx-auto h-[480px] w-[120%] rounded-[50px] bg-[radial-gradient(circle_at_center,_rgba(25,195,125,0.12),_transparent_70%)] opacity-70 blur-3xl" />
      </div>
      <div className="flex min-h-screen flex-col">
        {showShellHeader && (
          <header className="sticky top-0 z-40 border-b border-premium-stroke/60 bg-premium-base/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 text-sm text-premium-muted sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3 text-premium-text">
                <WebgptIcon size={32} className="border-premium-stroke/80" />
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-premium-muted">よやくらく</p>
                  <p className="-mt-1 text-base font-semibold text-premium-text">Control Hub</p>
                </div>
              </Link>
              <div className="flex items-center gap-4">
                <nav className="hidden items-center gap-5 sm:flex">
                  {navLinks.map((link) => {
                    const isActive = router.pathname === link.href || router.pathname.startsWith(`${link.href}/`);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={clsx(
                          'text-xs font-semibold tracking-[0.25em] uppercase transition',
                          isActive ? 'text-premium-text' : 'text-premium-muted hover:text-premium-text',
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-full border border-premium-stroke/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-premium-text transition hover:border-premium-accent hover:text-premium-accent"
                >
                  コンソール
                </Link>
              </div>
            </div>
          </header>
        )}

        {fullWidth ? (
          mainContent
        ) : (
          <div className="mx-auto flex w-full flex-1 flex-col max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {mainContent}
          </div>
        )}
      </div>
      <Script
        src="https://yoyakuraku.com/api/embed/script?site_id=d2f19a87-aca1-4276-ac76-8052b589d365"
        strategy="afterInteractive"
      />
            {/* <Script
        src="http://localhost:3000/api/embed/script?site_id=fe8aba45-7a35-41a5-9e57-9fbb88224c03"
        strategy="afterInteractive"
      /> */}
    </div>
  );
}
