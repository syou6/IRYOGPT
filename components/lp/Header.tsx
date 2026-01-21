import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { label: "機能", href: "#features" },
    { label: "料金", href: "#pricing" },
    { label: "導入の流れ", href: "#flow" },
    { label: "対象業種", href: "#departments" },
    { label: "よくある質問", href: "#faq" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 bg-white z-50 shadow-sm">
      <div className="max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-[70px] lg:h-[80px]">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] lg:text-[11px] text-gray-500 tracking-tight">医療・美容業界特化 AI予約システム</span>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-sm">
                  IR
                </div>
                <span className="text-[20px] lg:text-[24px] font-bold text-emerald-600 tracking-tight">よやくらく</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[13px] xl:text-[14px] font-medium text-gray-700 hover:text-emerald-600 transition-colors whitespace-nowrap"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-5">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div className="flex flex-col leading-tight">
                <span className="font-bold text-[18px] xl:text-[20px] text-gray-800 tracking-tight">090-3639-9477</span>
                <span className="text-[9px] xl:text-[10px] text-gray-500">（平日 9:00-18:00）</span>
              </div>
            </div>

            <Link
              href="/contact"
              className="px-4 xl:px-5 py-2.5 border-2 border-emerald-500 text-emerald-600 rounded-full text-[13px] font-medium hover:bg-emerald-500 hover:text-white transition-colors whitespace-nowrap"
            >
              お問い合わせ
            </Link>

            <Link
              href="/contact"
              className="px-4 xl:px-5 py-2.5 bg-emerald-500 text-white rounded-full text-[13px] font-medium hover:bg-emerald-600 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              無料相談する
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-t"
          >
            <nav className="flex flex-col p-4 gap-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-sm font-medium text-gray-700 py-2"
                >
                  {item.label}
                </a>
              ))}
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-bold">090-3639-9477</span>
                </div>
                <Link
                  href="/contact"
                  className="block w-full px-4 py-3 bg-emerald-500 text-white rounded-full text-sm font-medium text-center"
                >
                  無料相談する
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
