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
              <p>4. 当社の損害賠償責任は、当社の故意または重過失による場合を除き、利用者が過去12ヶ月間に当社に支払った利用料金の総額を上限とします。</p>
              <p>5. 当社は、OpenAI、Google、Supabase等の第三者サービスの障害、仕様変更、またはサービス終了に起因する損害について責任を負いません。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第7条（予約の正確性）</h2>
            <div className="mt-4 space-y-2">
              <p>1. 本サービスはAI技術を使用しており、予約内容の誤認識、誤登録が発生する可能性があります。</p>
              <p>2. 利用者（医療機関等）は、本サービスを通じて行われた予約について、最終的な確認および管理の責任を負うものとします。</p>
              <p>3. AIの誤認識等により生じた予約の重複、誤り、または患者とのトラブルについて、当社は責任を負いません。</p>
              <p>4. 利用者は、本サービスの予約データを定期的に確認し、必要に応じて修正を行うものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第8条（患者データの取扱い）</h2>
            <div className="mt-4 space-y-2">
              <p>1. 本サービスを通じて取得される患者の個人情報（氏名、電話番号、症状等）について、利用者（医療機関等）がデータ管理者となります。</p>
              <p>2. 当社は、利用者の指示に基づきデータを処理するデータ処理者として、適切なセキュリティ対策を講じます。</p>
              <p>3. 利用者は、患者に対して本サービスの利用および個人情報の取扱いについて適切に説明し、必要な同意を取得する責任を負います。</p>
              <p>4. 患者データの漏洩、紛失、不正アクセス等が発生した場合、利用者の管理不備に起因するものについては、当社は責任を負いません。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第9条（解約）</h2>
            <div className="mt-4 space-y-2">
              <p>1. 利用者は、当社所定の方法により、いつでも本サービスを解約することができます。</p>
              <p>2. 解約月の末日をもってサービスを終了いたします。</p>
              <p>3. 解約時点で未払いの利用料金がある場合、利用者は速やかにこれを支払うものとします。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第10条（規約の変更）</h2>
            <p className="mt-4">
              当社は、必要に応じて本規約を変更することができます。
              変更後の規約は、当ウェブサイトに掲載した時点から効力を生じます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-premium-text border-b border-premium-stroke pb-2">第11条（準拠法・管轄裁判所）</h2>
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
