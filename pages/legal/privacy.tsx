import Link from 'next/link';
import Layout from '@/components/layout';

export default function Privacy() {
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
        <h1 className="text-3xl font-bold text-premium-text sm:text-4xl">プライバシーポリシー</h1>

        <div className="mt-8 space-y-8 text-premium-muted leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">1. 個人情報の収集について</h2>
            <p className="mt-4">
              当社は、サービスの提供にあたり、以下の個人情報を収集することがあります。
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>氏名、メールアドレス、電話番号</li>
              <li>会社名、所在地</li>
              <li>サービス利用履歴</li>
              <li>お問い合わせ内容</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">2. 個人情報の利用目的</h2>
            <p className="mt-4">収集した個人情報は、以下の目的で利用いたします。</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>サービスの提供・運営</li>
              <li>お問い合わせへの対応</li>
              <li>サービスに関するご案内</li>
              <li>サービスの改善・新サービスの開発</li>
              <li>利用規約に違反する行為への対応</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">3. 個人情報の第三者提供</h2>
            <p className="mt-4">
              当社は、以下の場合を除き、お客様の個人情報を第三者に提供することはありません。
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>お客様の同意がある場合</li>
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要がある場合</li>
              <li>サービス提供に必要な範囲で業務委託先に提供する場合</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">4. 個人情報の管理</h2>
            <p className="mt-4">
              当社は、個人情報の漏洩、滅失、毀損の防止その他の個人情報の安全管理のために、
              必要かつ適切な措置を講じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">5. Cookieの使用について</h2>
            <p className="mt-4">
              当社のウェブサイトでは、サービスの利便性向上のためCookieを使用しています。
              ブラウザの設定によりCookieを無効にすることも可能ですが、
              一部のサービスが正常に動作しない場合があります。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">6. 個人情報の開示・訂正・削除</h2>
            <p className="mt-4">
              お客様ご本人から個人情報の開示、訂正、削除のご請求があった場合、
              本人確認の上、合理的な期間内に対応いたします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">7. プライバシーポリシーの変更</h2>
            <p className="mt-4">
              当社は、必要に応じて本プライバシーポリシーを変更することがあります。
              変更後のプライバシーポリシーは、当ウェブサイトに掲載した時点から効力を生じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">8. お問い合わせ</h2>
            <p className="mt-4">
              個人情報の取り扱いに関するお問い合わせは、下記までご連絡ください。
            </p>
            <p className="mt-2">メールアドレス: info@yoyakuraku.com</p>
          </section>
        </div>

        <p className="mt-8 text-sm text-premium-muted">制定日: {new Date().getFullYear()}年1月1日</p>

        <div className="mt-12 text-center">
          <Link href="/" className="text-premium-accent hover:underline">
            トップページに戻る
          </Link>
        </div>
      </div>
    </Layout>
  );
}
