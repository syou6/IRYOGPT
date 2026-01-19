import Link from 'next/link';
import Layout from '@/components/layout';

export default function Tokushoho() {
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
        <h1 className="text-3xl font-bold text-premium-text sm:text-4xl">特定商取引法に基づく表記</h1>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">販売事業者</h2>
            <p className="mt-4 text-premium-muted">【事業者名を記載】</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">代表者</h2>
            <p className="mt-4 text-premium-muted">【代表者名を記載】</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">所在地</h2>
            <p className="mt-4 text-premium-muted">【住所を記載】</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">電話番号</h2>
            <p className="mt-4 text-premium-muted">【電話番号を記載】</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">メールアドレス</h2>
            <p className="mt-4 text-premium-muted">heartssh@gmail.com</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">販売価格</h2>
            <div className="mt-4 text-premium-muted">
              <p>初期導入費用: 300,000円（税別）</p>
              <p>月額利用料: 100,000円（税別）</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">支払方法</h2>
            <p className="mt-4 text-premium-muted">銀行振込、クレジットカード決済</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">支払時期</h2>
            <div className="mt-4 text-premium-muted">
              <p>初期導入費用: 契約締結後、サービス開始前までにお支払い</p>
              <p>月額利用料: 毎月末日締め、翌月末日払い</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">サービス提供時期</h2>
            <p className="mt-4 text-premium-muted">契約締結後、最短10日程度で本番公開</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">返品・キャンセルについて</h2>
            <div className="mt-4 text-premium-muted">
              <p>サービスの性質上、提供開始後の返金には応じかねます。</p>
              <p>解約は月単位で可能です。解約月の末日をもってサービスを終了いたします。</p>
            </div>
          </section>
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
