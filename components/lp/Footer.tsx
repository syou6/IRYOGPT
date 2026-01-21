import Link from "next/link";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12 lg:py-20">
      <div className="max-w-[1300px] lg:max-w-[1500px] 2xl:max-w-[1700px] mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 lg:gap-12 mb-10">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-lg">
                IR
              </div>
              <span className="text-[20px] font-bold">よやくらく</span>
            </Link>
            <p className="text-[13px] lg:text-[14px] text-gray-400 leading-relaxed max-w-md">
              医療・美容業界特化のAI予約システム。24時間365日の自動予約受付で、予約対応の人件費を年間250万円削減。
            </p>
            <div className="mt-6 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-[15px] font-bold">090-3639-9477</span>
              <span className="text-[12px] text-gray-500">（平日 9:00-18:00）</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-[14px] font-bold mb-4">サービス</h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <a href="#features" className="text-gray-400 hover:text-white transition">機能</a>
              </li>
              <li>
                <a href="#pricing" className="text-gray-400 hover:text-white transition">料金</a>
              </li>
              <li>
                <a href="#flow" className="text-gray-400 hover:text-white transition">導入の流れ</a>
              </li>
              <li>
                <a href="#faq" className="text-gray-400 hover:text-white transition">よくある質問</a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-[14px] font-bold mb-4">会社情報</h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link href="/legal/company" className="text-gray-400 hover:text-white transition">会社概要</Link>
              </li>
              <li>
                <Link href="/legal/tokushoho" className="text-gray-400 hover:text-white transition">特定商取引法に基づく表記</Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="text-gray-400 hover:text-white transition">プライバシーポリシー</Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-gray-400 hover:text-white transition">利用規約</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-gray-500">
              © {new Date().getFullYear()} よやくらく（合同会社AMOR）. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-[12px] text-gray-400 hover:text-white transition"
              >
                管理画面ログイン
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
