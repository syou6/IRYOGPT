import Link from 'next/link';
import Layout from '@/components/layout';

export default function Company() {
  return (
    <Layout showShellHeader={false} fullWidth darkMode={false}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-premium-accent text-white font-bold text-lg">
              IR
            </div>
            <span className="text-xl font-bold text-premium-text">よやくらく</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-premium-text sm:text-4xl">会社概要</h1>

        <div className="mt-8 overflow-hidden rounded-2xl border border-premium-stroke bg-white">
          <table className="w-full">
            <tbody className="divide-y divide-premium-stroke">
              <tr>
                <th className="bg-premium-surface px-6 py-4 text-left text-base font-semibold text-premium-text w-1/3">
                  会社名
                </th>
                <td className="px-6 py-4 text-base text-premium-muted">
                  合同会社AMOR
                </td>
              </tr>
              <tr>
                <th className="bg-premium-surface px-6 py-4 text-left text-base font-semibold text-premium-text">
                  代表者
                </th>
                <td className="px-6 py-4 text-base text-premium-muted">
                  代表社員 川本 翔
                </td>
              </tr>
              <tr>
                <th className="bg-premium-surface px-6 py-4 text-left text-base font-semibold text-premium-text">
                  所在地
                </th>
                <td className="px-6 py-4 text-base text-premium-muted">
                  〒160-0022<br />
                  東京都新宿区新宿1-36-2<br />
                  新宿第七葉山ビル 3F
                </td>
              </tr>
              <tr>
                <th className="bg-premium-surface px-6 py-4 text-left text-base font-semibold text-premium-text">
                  電話番号
                </th>
                <td className="px-6 py-4 text-base text-premium-muted">
                  090-3639-9477
                </td>
              </tr>
              <tr>
                <th className="bg-premium-surface px-6 py-4 text-left text-base font-semibold text-premium-text">
                  メールアドレス
                </th>
                <td className="px-6 py-4 text-base text-premium-muted">
                  info@amorjp.com
                </td>
              </tr>
              <tr>
                <th className="bg-premium-surface px-6 py-4 text-left text-base font-semibold text-premium-text">
                  事業内容
                </th>
                <td className="px-6 py-4 text-base text-premium-muted">
                  <ul className="list-disc list-inside space-y-1">
                    <li>WEBサイト制作・運用</li>
                    <li>業務システム開発</li>
                    <li>アプリケーション開発</li>
                    <li>AI予約システム「よやくらく」の開発・運営</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <th className="bg-premium-surface px-6 py-4 text-left text-base font-semibold text-premium-text">
                  URL
                </th>
                <td className="px-6 py-4 text-base">
                  <a
                    href="https://amorjp.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-premium-accent hover:underline"
                  >
                    https://amorjp.com
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-premium-accent hover:underline">
            トップページに戻る
          </Link>
        </div>
      </div>
    </Layout>
  );
}
