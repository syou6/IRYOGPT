import { motion } from "framer-motion";
import Link from "next/link";

const CampaignBanner = () => {
  return (
    <section className="py-10 lg:py-16 bg-gradient-to-b from-white to-emerald-50/50 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="hidden lg:block absolute -top-20 -right-20 w-48 h-48 rounded-full bg-emerald-100/50" />
      <div className="hidden lg:block absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-emerald-100/50" />

      <div className="max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-3xl p-6 lg:p-10 text-white text-center shadow-xl"
        >
          <div className="inline-block px-6 py-3 bg-white/20 rounded-full text-lg font-semibold mb-6">
            期間限定キャンペーン
          </div>
          <h3 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            初期導入費用 <span className="text-yellow-300">30万円OFF</span>
          </h3>
          <p className="text-xl lg:text-2xl opacity-90 mb-10">
            先着10社限定！通常60万円 → <span className="font-bold">30万円</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <Link
              href="/contact"
              className="px-12 py-5 bg-white text-emerald-600 rounded-full font-bold text-xl hover:shadow-lg transition-shadow"
            >
              キャンペーンに申し込む
            </Link>
            <a
              href="tel:090-3639-9477"
              className="px-12 py-5 border-2 border-white text-white rounded-full font-bold text-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              電話で相談
            </a>
          </div>

          <p className="text-base opacity-70 mt-6">
            ※ 2025年3月末までのお申し込みに限ります
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CampaignBanner;
