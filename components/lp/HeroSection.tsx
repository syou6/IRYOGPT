import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

const HeroSection = () => {
  return (
    <section
      className="relative pt-[90px] lg:pt-[100px] pb-16 lg:pb-24 overflow-hidden min-h-[600px] lg:min-h-[700px]"
      style={{
        background: "linear-gradient(135deg, #0a3d3d 0%, #0d4a47 50%, #064038 100%)",
      }}
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-600/10 blur-3xl" />
      </div>

      <div className="max-w-[1400px] lg:max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-white"
          >
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-2 text-[14px] font-medium text-emerald-300"
            >
              医療・美容業界特化
            </motion.p>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] font-bold leading-[1.1] mt-8 mb-6 lg:mb-8">
              <span className="whitespace-nowrap">もう予約電話に</span>
              <br />
              <span className="whitespace-nowrap text-emerald-400">振り回されない</span>
            </h1>

            <p className="text-2xl sm:text-3xl opacity-80 mb-8 lg:mb-10 leading-relaxed">
              24時間365日、AIが予約を自動受付。
              <br />
              スタッフは本業に集中できます。
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/contact"
                className="px-6 lg:px-8 py-3.5 lg:py-4 bg-white text-emerald-600 rounded-full font-medium text-[14px] lg:text-[15px] flex items-center justify-center gap-3 hover:shadow-lg transition-shadow"
              >
                <span>無料で相談する</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <a
                href="#features"
                className="px-6 lg:px-8 py-3.5 lg:py-4 border-2 border-white/30 text-white rounded-full font-medium text-[14px] lg:text-[15px] flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
              >
                機能を見る
              </a>
            </div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-12 lg:mt-16 flex flex-wrap items-center gap-8 lg:gap-12 border-t border-white/10 pt-8 lg:pt-10"
            >
              <div className="flex items-center gap-4">
                <Image
                  src="https://img.icons8.com/3d-fluency/94/hospital.png"
                  alt="医療"
                  width={56}
                  height={56}
                />
                <div>
                  <p className="text-xl lg:text-2xl font-bold text-white">医療・美容特化</p>
                  <p className="text-lg text-white/60">業界専門AI</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Image
                  src="https://img.icons8.com/3d-fluency/94/sun.png"
                  alt="24時間"
                  width={56}
                  height={56}
                />
                <div>
                  <p className="text-xl lg:text-2xl font-bold text-white">24時間対応</p>
                  <p className="text-lg text-white/60">夜間・休日も</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Image
                  src="https://img.icons8.com/3d-fluency/94/phone.png"
                  alt="電話削減"
                  width={56}
                  height={56}
                />
                <div>
                  <p className="text-xl lg:text-2xl font-bold text-white">電話80%削減</p>
                  <p className="text-lg text-white/60">業務効率化</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Content - Device Mockups */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:flex lg:justify-center lg:items-center"
          >
            <div className="relative">
              {/* Main laptop mockup */}
              <motion.div
                className="relative z-10"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="rounded-t-3xl bg-gray-800 p-4 shadow-2xl">
                  <div className="absolute left-1/2 top-3 h-3 w-3 -translate-x-1/2 rounded-full bg-gray-600" />
                  <div className="overflow-hidden rounded-xl bg-white">
                    <video autoPlay muted loop playsInline className="h-auto w-[480px] xl:w-[540px] 2xl:w-[600px]">
                      <source src="/videos/demo.mp4" type="video/mp4" />
                    </video>
                  </div>
                </div>
                <div className="relative h-5 rounded-b-xl bg-gray-700">
                  <div className="absolute inset-x-1/4 top-0 h-2 rounded-b bg-gray-600" />
                </div>
                <div className="h-3 rounded-b-xl bg-gray-800 shadow-lg" />
              </motion.div>

              {/* Floating cards */}
              <motion.div
                className="absolute -left-12 top-20 z-20 rounded-xl bg-white p-5 shadow-xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500">本日の予約</p>
                    <p className="text-[22px] font-bold text-gray-800">12件</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute right-4 top-12 z-20 rounded-xl bg-white p-5 shadow-xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500">電話削減率</p>
                    <p className="text-[22px] font-bold text-emerald-600">80%</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute bottom-12 right-0 z-20 rounded-xl bg-white p-5 shadow-xl"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                    <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500">年間削減額</p>
                    <p className="text-[22px] font-bold text-orange-600">250万円</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
