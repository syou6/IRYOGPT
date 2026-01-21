import { motion } from "framer-motion";
import Link from "next/link";

const VisionSection = () => {
  return (
    <section className="py-14 lg:py-20 bg-gradient-to-br from-[#0a3d3d] via-[#0d4a47] to-[#064038] text-white overflow-hidden">
      <div className="max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-center lg:text-left"
          >
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 lg:mb-10 leading-tight">
              <span className="text-emerald-400">予約対応</span>から解放され、
              <br />
              <span className="text-emerald-400">本業</span>に集中できる未来へ
            </h2>
            <p className="text-xl lg:text-2xl 2xl:text-3xl opacity-80 mb-10 lg:mb-12 leading-relaxed">
              AIの力で、医療・美容業界の働き方を変える
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
              <Link
                href="/contact"
                className="px-12 py-5 bg-white text-emerald-600 rounded-full text-xl font-bold hover:shadow-lg transition-shadow"
              >
                無料相談する
              </Link>
              <Link
                href="/legal/company"
                className="px-12 py-5 border-2 border-white text-white rounded-full text-xl font-bold hover:bg-white/10 transition-colors"
              >
                会社概要
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="hidden lg:block"
          >
            <div className="relative">
              {/* Vision visualization */}
              <div className="flex items-center justify-center gap-4 2xl:gap-6">
                {/* AI Card */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="bg-white/10 rounded-2xl p-6 2xl:p-8 backdrop-blur-sm text-center w-[160px] 2xl:w-[200px]"
                >
                  <div className="w-16 h-16 2xl:w-20 2xl:h-20 bg-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 2xl:w-10 2xl:h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="text-3xl 2xl:text-4xl font-bold text-emerald-400 mb-2 whitespace-nowrap">AI</div>
                  <p className="text-base 2xl:text-lg font-bold opacity-95 whitespace-nowrap">24時間365日</p>
                  <p className="text-sm 2xl:text-base font-medium opacity-75 mt-1 whitespace-nowrap">予約を自動受付</p>
                </motion.div>

                {/* Arrow */}
                <div className="text-emerald-400/70 text-4xl 2xl:text-5xl font-bold">+</div>

                {/* Connection Card */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  className="bg-white/10 rounded-2xl p-6 2xl:p-8 backdrop-blur-sm text-center w-[160px] 2xl:w-[200px]"
                >
                  <div className="w-16 h-16 2xl:w-20 2xl:h-20 bg-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 2xl:w-10 2xl:h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="text-3xl 2xl:text-4xl font-bold text-emerald-400 mb-2 whitespace-nowrap">連携</div>
                  <p className="text-base 2xl:text-lg font-bold opacity-95 whitespace-nowrap">スプレッドシート</p>
                  <p className="text-sm 2xl:text-base font-medium opacity-75 mt-1 whitespace-nowrap">に自動で記録</p>
                </motion.div>

                {/* Arrow */}
                <div className="text-emerald-400/70 text-4xl 2xl:text-5xl font-bold">=</div>

                {/* Human Card */}
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                  className="bg-emerald-500/20 rounded-2xl p-6 2xl:p-8 backdrop-blur-sm text-center w-[160px] 2xl:w-[200px] border border-emerald-400/30"
                >
                  <div className="w-16 h-16 2xl:w-20 2xl:h-20 bg-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 2xl:w-10 2xl:h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-3xl 2xl:text-4xl font-bold text-emerald-400 mb-2 whitespace-nowrap">スタッフ</div>
                  <p className="text-base 2xl:text-lg font-bold opacity-95 whitespace-nowrap">本業に集中</p>
                  <p className="text-sm 2xl:text-base font-medium opacity-75 mt-1 whitespace-nowrap">患者ケアに専念</p>
                </motion.div>
              </div>

              {/* Result */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="mt-10 bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 rounded-2xl p-8 backdrop-blur-sm text-center border border-emerald-400/20"
              >
                <p className="text-2xl font-bold text-emerald-300 tracking-wide">患者様もスタッフも、みんなハッピーに</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default VisionSection;
