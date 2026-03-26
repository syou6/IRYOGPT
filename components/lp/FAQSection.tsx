import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "導入にどのくらい時間がかかりますか？",
    answer: "最短10日で本番公開が可能です。初回ヒアリング（約1時間）→ AIの学習・設定（弊社対応）→ 動作確認→ 公開、という流れです。院内での準備作業はほぼ不要で、院長先生やスタッフの手を煩わせません。",
  },
  {
    question: "既存の予約システムと連携できますか？",
    answer: "Googleスプレッドシートを中心とした予約管理に対応しています。EPARK・デジスマ診療などの既存システムとの連携については、個別にご要件をお伺いしたうえでご提案いたします。まずはお気軽にご相談ください。",
  },
  {
    question: "AIが間違った回答をすることはありますか？",
    answer: "診断・治療・症状に関する医療アドバイスは一切行わないよう設計されています。予約と基本的な院内案内に完全特化しており、回答できない質問は「直接クリニックへご連絡ください」と案内します。院長先生が安心して患者様に提供できる設計です。",
  },
  {
    question: "解約はいつでもできますか？",
    answer: "はい、月単位での解約が可能です。最低契約期間はございません。ただし、導入後3ヶ月以内に成果を実感いただけるよう、弊社も全力でサポートいたします。",
  },
  {
    question: "スタッフのトレーニングは必要ですか？",
    answer: "特別なトレーニングは一切不要です。予約確認はGoogleスプレッドシートを見るだけ。普段スマホやPCを使っている方なら誰でも即日から使いこなせます。初期設定・運用マニュアルの作成はすべて弊社が対応します。",
  },
  {
    question: "EPARKやデジスマ診療との違いは何ですか？",
    answer: "既存の予約サービスは患者様がフォームに入力する方式ですが、よやくらくは会話（チャット・LINE）で予約が完結します。入力の手間がないため離脱率が低く、夜間・休日でも自動対応できるため、取りこぼしを防げます。また、よくある質問への自動回答により、予約以外の電話も大幅に削減します。",
  },
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-14 lg:py-24 bg-gray-50">
      <div className="max-w-[1000px] lg:max-w-[1200px] 2xl:max-w-[1400px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <p className="text-lg lg:text-xl font-semibold text-emerald-600 mb-4 tracking-wide">FAQ</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            よくある質問
          </h2>
        </motion.div>

        <div className="space-y-4 lg:space-y-5">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <motion.div
                key={faq.question}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-8 lg:px-12 py-7 lg:py-9 text-left shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xl lg:text-2xl font-bold text-gray-900 pr-4">
                      {faq.question}
                    </p>
                    <span className="flex-shrink-0 text-emerald-500 text-4xl font-light">
                      {isOpen ? "−" : "+"}
                    </span>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-6 text-lg lg:text-xl text-gray-600 leading-relaxed border-t pt-6">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
