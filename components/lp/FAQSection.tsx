import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "導入にどのくらい時間がかかりますか？",
    answer: "最短10日で本番公開が可能です。初回ヒアリング後、ナレッジ同期、テスト、公開という流れで進めます。",
  },
  {
    question: "既存の予約システムと連携できますか？",
    answer: "Googleスプレッドシートを使用した予約管理に対応しています。既存システムとの連携については個別にご相談ください。",
  },
  {
    question: "AIが間違った回答をすることはありますか？",
    answer: "医療アドバイスは一切行わないよう設計されています。予約と基本的なご案内に特化し、複雑な質問は「お問い合わせください」と案内します。",
  },
  {
    question: "解約はいつでもできますか？",
    answer: "はい、月単位で解約可能です。最低契約期間はございません。",
  },
  {
    question: "スタッフのトレーニングは必要ですか？",
    answer: "特別なトレーニングは不要です。Googleスプレッドシートを確認するだけなので、普段PCやスマホを使っている方なら誰でも操作できます。",
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
