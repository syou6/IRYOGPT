import { motion } from "framer-motion";
import Link from "next/link";

const features = [
  "AIチャットボット構築",
  "予約システム連携",
  "HP情報の学習・回答",
  "導入サポート",
  "月次レポート",
  "継続的な改善提案",
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-14 lg:py-24 bg-white">
      <div className="max-w-[1100px] lg:max-w-[1300px] 2xl:max-w-[1500px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <p className="text-lg lg:text-xl font-semibold text-emerald-600 mb-4 tracking-wide">PRICING</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            シンプルな料金体系
          </h2>
          <p className="mt-6 text-xl lg:text-2xl text-gray-600">
            追加料金なし。必要な機能がすべて含まれています
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Standard Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-emerald-500 rounded-2xl shadow-xl overflow-hidden text-white"
          >
            <div className="bg-emerald-600 p-6 lg:p-8">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-white/20 rounded text-sm font-medium">おすすめ</span>
              </div>
              <h3 className="text-xl lg:text-2xl font-bold mt-3 tracking-tight">スタンダードプラン</h3>
              <p className="text-sm opacity-80 mt-2">本格的に活用したい方向け</p>
            </div>
            <div className="p-6 lg:p-8">
              <div className="mb-6">
                <div className="text-sm opacity-80 mb-2">初期費用</div>
                <div className="text-4xl lg:text-5xl font-bold leading-none tracking-tight">
                  ¥300,000<span className="text-base lg:text-lg font-normal opacity-80">（税別）</span>
                </div>
              </div>
              <div className="mb-8">
                <div className="text-sm opacity-80 mb-2">月額費用</div>
                <div className="text-4xl lg:text-5xl font-bold leading-none tracking-tight">
                  ¥100,000<span className="text-base lg:text-lg font-normal opacity-80">/月</span>
                </div>
              </div>

              {/* 安心保証バッジ */}
              <div className="bg-white/10 rounded-xl p-4 mb-6 border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-bold text-base">導入後3ヶ月間 無制限サポート</div>
                    <div className="text-sm opacity-80">設定変更・運用相談・トラブル対応すべて無料</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/20 pt-6 mb-6">
                <div className="text-base font-bold mb-4">含まれる機能</div>
                <ul className="space-y-3 text-base">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/contact"
                className="block w-full py-4 bg-white text-emerald-600 rounded-full font-bold text-base lg:text-lg text-center hover:bg-white/90 transition-colors tracking-wide"
              >
                お問い合わせ
              </Link>
            </div>
          </motion.div>

          {/* Custom Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200"
          >
            <div className="bg-gray-100 p-6 lg:p-8">
              <h3 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">カスタムプラン</h3>
              <p className="text-sm text-gray-600 mt-2">特別なご要望がある方向け</p>
            </div>
            <div className="p-6 lg:p-8">
              <div className="mb-8 lg:mb-10">
                <div className="text-xl lg:text-2xl text-gray-700 mb-5 leading-relaxed font-medium tracking-tight">
                  運用に合わせて個別に
                  <br />
                  お見積りいたします
                </div>
                <p className="text-base text-gray-500 leading-relaxed tracking-wide">
                  複数店舗展開、独自機能追加、他システム連携など、お客様の課題やご要望をヒアリングし、最適なプランをご提案いたします。
                </p>
              </div>

              <div className="border-t pt-6 mb-6">
                <div className="text-base font-bold text-gray-900 mb-4">カスタム例</div>
                <ul className="space-y-3 text-base text-gray-600">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    複数店舗・複数診療科対応
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    LINE公式アカウント連携
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    予約リマインド通知
                  </li>
                </ul>
              </div>

              <Link
                href="/contact"
                className="block w-full py-4 border-2 border-emerald-500 text-emerald-600 rounded-full font-bold text-base lg:text-lg text-center hover:bg-emerald-500 hover:text-white transition-colors tracking-wide"
              >
                お問い合わせ
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
