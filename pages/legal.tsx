import Link from 'next/link';
import Layout from '@/components/layout';

const legalRows = [
  { label: '販売事業者名', value: 'WEBGPT（運営会社：Tech Samurai合同会社）' },
  { label: '代表責任者', value: '川本 翔' },
  { label: '所在地', value: '東京都新宿区新宿1-36-2 新宿第七葉山ビル3F' },
  { label: '電話番号', value: '+81 852 52 7323' },
  { label: 'メールアドレス', value: 'heartssh@gmail.com' },
  { label: '販売価格', value: '各プランの税込価格に基づきます（定期課金は更新時に自動請求）' },
  { label: '商品代金以外の料金', value: '通信費等はお客様のご負担となります' },
  { label: '支払方法', value: 'クレジットカード（Stripe決済）' },
  { label: '支払時期', value: '契約時および更新時に課金されます' },
  { label: '提供時期', value: 'お申し込み完了後、当社が学習を代行し準備が整い次第ご利用可能' },
  { label: '返品・キャンセル', value: 'デジタルサービスの特性上、原則として返金・キャンセル不可（不具合時は個別対応）' },
  { label: '中途解約', value: '途中解約による返金は承っておりません。次回更新分から停止となります' },
];

const termsList = [
  '本サービスは利用登録完了時点で本規約に同意したものとみなします。',
  '法令違反や第三者の権利侵害となる行為は禁止します。',
  '保守・災害等でサービスを停止する場合があります。停止による損害については責任を負いません。',
  '提供情報の正確性・有用性は保証されず、利用による損害についても責任を負いません。',
  '知的財産権は当社または権利者に帰属し、無断利用は禁止します。',
  '個人情報はプライバシーポリシーに従って取り扱います。',
  '規約は予告なく変更される場合があります。重要な変更はサイト上で周知します。',
];

const privacyList = [
  '取得情報：登録情報（氏名・メールアドレス等）、アクセスログ、チャット統計など。',
  '利用目的：サービス提供、サポート対応、改善・分析、不正防止、各種案内。',
  '第三者提供：Stripe等の決済代行会社や分析ツールなど、必要な範囲で提供する場合があります。',
  '安全管理：漏洩防止のため適切な管理を行い、不要になったデータは削除します。',
  '利用者の権利：開示・訂正・利用停止等の請求に応じます。',
];

export default function LegalPage() {
  return (
    <Layout>
      <div className="relative mx-auto max-w-5xl px-4 py-10 text-slate-100 sm:py-12">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">Legal</p>
          <h1 className="mt-2 text-4xl font-semibold text-white">特定商取引法に基づく表記</h1>
          <p className="mt-3 text-sm text-slate-300">
            WEBGPT（運営会社：Tech Samurai合同会社）が提供するサービスに関する法定表記です。
          </p>
          <div className="mt-4 flex justify-center">
            <Link href="/" className="rounded-full border border-white/20 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
              LP に戻る
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 text-sm text-slate-200 md:grid-cols-2">
          {legalRows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">{row.label}</p>
              <p className="mt-1 text-sm">{row.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
          <h2 className="text-2xl font-semibold text-white">利用規約 (要約)</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            {termsList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
          <h2 className="text-2xl font-semibold text-white">プライバシーポリシー (要約)</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            {privacyList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-400">お問い合わせ: heartssh@gmail.com</p>
        </section>
      </div>
    </Layout>
  );
}
