import Link from 'next/link';
import Layout from '@/components/layout';

export default function Terms() {
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
        <h1 className="text-3xl font-bold text-premium-text sm:text-4xl">利用規約</h1>

        <div className="mt-8 space-y-8 text-premium-muted leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第1条（適用）</h2>
            <p className="mt-4">
              本規約は、当社が提供する「よやくらく」（以下「本サービス」といいます）の利用に関する条件を、
              本サービスを利用するお客様（以下「利用者」といいます）と当社との間で定めるものです。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第2条（サービス内容）</h2>
            <p className="mt-4">
              本サービスは、AI技術を活用した予約受付システムを提供するものです。
              具体的なサービス内容は、当社が別途定めるものとします。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第3条（利用料金）</h2>
            <div className="mt-4 space-y-2">
              <p>1. 本サービスの利用料金は、当社が別途定める料金表に基づきます。</p>
              <p>2. 利用者は、当社が指定する方法により利用料金を支払うものとします。</p>
              <p>3. 支払われた利用料金は、理由の如何を問わず返金いたしません。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第4条（禁止事項）</h2>
            <p className="mt-4">利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>法令または公序良俗に違反する行為</li>
              <li>当社または第三者の権利を侵害する行為</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>不正アクセスまたはこれを試みる行為</li>
              <li>本サービスを第三者に再販売する行為</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第5条（サービスの停止・中断）</h2>
            <div className="mt-4 space-y-2">
              <p>当社は、以下の場合、事前の通知なく本サービスの全部または一部を停止・中断することができます。</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>システムの保守・点検を行う場合</li>
                <li>天災、停電等の不可抗力により提供が困難な場合</li>
                <li>その他、当社がやむを得ないと判断した場合</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第6条（免責事項）</h2>
            <div className="mt-4 space-y-2">
              <p>1. 当社は、本サービスの完全性、正確性、有用性等について保証しません。</p>
              <p>2. 本サービスの利用により生じた損害について、当社の故意または重過失による場合を除き、当社は責任を負いません。</p>
              <p>3. AIによる応答内容については、医療アドバイスを含まないよう設計されていますが、利用者は自己の責任において本サービスを利用するものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第7条（解約）</h2>
            <div className="mt-4 space-y-2">
              <p>1. 利用者は、当社所定の方法により、いつでも本サービスを解約することができます。</p>
              <p>2. 解約月の末日をもってサービスを終了いたします。</p>
              <p>3. 解約時点で未払いの利用料金がある場合、利用者は速やかにこれを支払うものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第8条（規約の変更）</h2>
            <p className="mt-4">
              当社は、必要に応じて本規約を変更することができます。
              変更後の規約は、当ウェブサイトに掲載した時点から効力を生じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第9条（準拠法・管轄裁判所）</h2>
            <div className="mt-4 space-y-2">
              <p>1. 本規約の解釈は、日本法に準拠するものとします。</p>
              <p>2. 本サービスに関する紛争については、当社の本店所在地を管轄する裁判所を専属的合意管轄裁判所とします。</p>
            </div>
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
