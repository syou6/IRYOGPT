import { motion } from "framer-motion";

const BeforeAfterSection = () => {
  return (
    <section className="py-14 lg:py-24 bg-gradient-to-b from-[#e8f4f8] to-white">
      <div className="max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            予約対応の悩みを
            <br />
            <span className="text-emerald-500">AIがまるっと解決</span>
          </h2>
        </motion.div>

        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute -left-2 -top-2 z-10 rounded-full bg-red-500 px-5 py-2 text-base font-bold text-white lg:-left-3 lg:-top-3">
              Before
            </div>
            <div className="rounded-2xl bg-red-50 p-6 lg:p-10">
              <div className="space-y-3 lg:space-y-4">
                <div className="rounded-lg bg-white px-5 py-4 text-base lg:text-lg font-medium text-red-600 shadow-sm">
                  <span className="mr-2">📞</span>電話が鳴り止まない
                </div>
                <div className="rounded-lg bg-white px-5 py-4 text-base lg:text-lg font-medium text-orange-600 shadow-sm">
                  <span className="mr-2">😰</span>施術中に対応できない
                </div>
                <div className="rounded-lg bg-white px-5 py-4 text-base lg:text-lg font-medium text-red-500 shadow-sm">
                  <span className="mr-2">📝</span>手書きでミス発生
                </div>
                <div className="rounded-lg bg-white px-5 py-4 text-base lg:text-lg font-medium text-orange-500 shadow-sm">
                  <span className="mr-2">🌙</span>夜間の予約逃す
                </div>
                <div className="rounded-lg bg-white px-5 py-4 text-base lg:text-lg font-medium text-red-600 shadow-sm">
                  <span className="mr-2">⚠️</span>ダブルブッキング
                </div>
                <div className="rounded-lg bg-white px-5 py-4 text-base lg:text-lg font-medium text-orange-600 shadow-sm">
                  <span className="mr-2">💸</span>人件費が高い
                </div>
              </div>
            </div>
          </motion.div>

          {/* Arrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center py-4 lg:py-0"
          >
            <div className="flex items-center gap-3">
              <div className="h-0.5 w-6 bg-gray-300 lg:w-10" />
              <div className="flex h-20 w-20 lg:h-24 lg:w-24 flex-col items-center justify-center rounded-2xl border-2 border-emerald-500 bg-white shadow-lg">
                <div className="flex h-10 w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg bg-emerald-500 text-white text-[14px] lg:text-[16px] font-bold">
                  IR
                </div>
                <span className="mt-1 text-[11px] lg:text-[12px] font-bold text-gray-800">よやくらく</span>
              </div>
              <div className="flex items-center">
                <div className="h-0.5 w-6 bg-emerald-500 lg:w-10" />
                <div className="h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-emerald-500" />
              </div>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute -right-2 -top-2 z-10 rounded-full bg-emerald-500 px-5 py-2 text-base font-bold text-white lg:-right-3 lg:-top-3">
              After
            </div>
            <div className="rounded-2xl bg-emerald-50 p-6 lg:p-10">
              <div className="space-y-5">
                {/* AI Chat Preview */}
                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm text-white font-bold">AI</div>
                    <span className="text-base font-bold text-gray-800">予約受付AI</span>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-600 font-medium">24時間稼働中</span>
                  </div>
                  <div className="space-y-3 text-base">
                    <div className="rounded-lg bg-gray-100 p-4 text-gray-600">明日の10時予約できますか？</div>
                    <div className="rounded-lg bg-emerald-100 p-4 text-emerald-700">はい、10時空いております。お名前をお聞かせください。</div>
                  </div>
                </div>

                {/* Benefits */}
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full bg-emerald-100 px-5 py-2 text-base font-semibold text-emerald-700">
                    ✓ 電話80%削減
                  </span>
                  <span className="rounded-full bg-emerald-100 px-5 py-2 text-base font-semibold text-emerald-700">
                    ✓ 24時間対応
                  </span>
                  <span className="rounded-full bg-emerald-100 px-5 py-2 text-base font-semibold text-emerald-700">
                    ✓ ミスゼロ
                  </span>
                  <span className="rounded-full bg-emerald-100 px-5 py-2 text-base font-semibold text-emerald-700">
                    ✓ 人件費削減
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterSection;
