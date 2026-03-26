import { motion } from "framer-motion";

const SupportSection = () => {
  return (
    <section className="py-14 lg:py-24 bg-gray-50">
      <div className="max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            <span className="text-emerald-500">導入後も安心のサポート体制</span>
          </h2>
          <p className="mt-6 text-xl lg:text-2xl text-gray-600">
            「うまく使えるか不安」という院長先生こそ、ぜひご相談ください
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 lg:p-10 text-center shadow-md"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 text-2xl lg:text-3xl mb-5">初期設定を全額代行</h4>
            <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
              AIの学習・設定・テストはすべて弊社が対応します。院長先生やスタッフの作業負担はゼロ。導入後の運用相談も同じ担当者が継続サポートします。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-8 lg:p-10 text-center shadow-md"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 text-2xl lg:text-3xl mb-5">月次レポートで効果を可視化</h4>
            <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
              毎月、予約件数・電話削減数・よくある質問などをレポートにまとめてご報告。データをもとにAIの回答精度を継続的に改善し、費用対効果を最大化します。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-8 lg:p-10 text-center shadow-md"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 text-2xl lg:text-3xl mb-5">3ヶ月間 無制限サポート</h4>
            <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
              導入後3ヶ月間は設定変更・運用相談・トラブル対応をすべて無料でご対応。電話・メール・チャットいずれでもお気軽にご連絡ください。
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SupportSection;
