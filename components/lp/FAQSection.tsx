import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "本当に10日で導入できますか？",
    answer: "はい。Day1-2：診療内容・予約フローのヒアリング、Day3-5：HPナレッジのAI学習＆システム設定、Day6-9：テスト運用（実際の予約で動作確認）、Day10：本番公開。この流れで最短10営業日での稼働が可能です。",
  },
  {
    question: "スタッフのトレーニングは必要ですか？",
    answer: "完全に不要です。スタッフがすることは「Googleスプレッドシートを確認する」これだけ。AIが予約した内容が自動で記入されるため、特別なシステム知識は一切不要です。",
  },
  {
    question: "月額費用は固定ですか？追加料金はかかりますか？",
    answer: "はい、完全固定額です。スタンダードプランは月額10万円で、予約件数が増えても追加料金は一切かかりません。10件でも1,000件でも同額です。",
  },
  {
    question: "AIが間違った回答をすることはありますか？",
    answer: "AIは「予約と案内」に専門化しているため、医療判断を求める質問には「診療内容についてはお電話ください」と自動案内します。回答範囲を限定することで、誤情報のリスクを最小化しています。",
  },
  {
    question: "既存の予約システムと連携できますか？",
    answer: "Googleスプレッドシートを使用した予約管理に標準対応しています。EPARK、デジスマ診療など既存システムとのAPI連携もカスタムプランで対応可能です。",
  },
  {
    question: "解約はいつでもできますか？",
    answer: "はい、月単位で解約可能です。最低契約期間はございません。安心してお試しいただけます。",
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
