import { motion } from "framer-motion";
import Link from "next/link";

interface ContactCTAProps {
  variant?: "default" | "simple";
}

const ContactCTA = ({ variant = "default" }: ContactCTAProps) => {
  if (variant === "simple") {
    return (
      <section className="py-12 lg:py-16 bg-emerald-500">
        <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-[18px] lg:text-[24px] text-white/95 mb-6 tracking-wide font-medium">
              予約対応でお困りの方、お気軽にご相談ください
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="px-10 py-4 bg-white text-emerald-600 rounded-full font-bold text-[16px] lg:text-[17px] hover:shadow-lg transition-shadow tracking-wide"
              >
                無料で相談する
              </Link>
              <a
                href="tel:090-3639-9477"
                className="px-10 py-4 border-2 border-white text-white rounded-full font-bold text-[16px] lg:text-[17px] hover:bg-white/10 transition-colors flex items-center justify-center gap-3 tracking-wide"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                090-3639-9477
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14 lg:py-24">
      <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-3xl bg-gradient-to-r from-emerald-500 to-emerald-600 p-10 lg:p-20 text-center text-white"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8">
            まずは無料相談から
          </h2>
          <p className="text-xl lg:text-2xl opacity-90 mb-12 max-w-3xl mx-auto leading-relaxed">
            導入についてのご質問、お見積もりなど、お気軽にご相談ください。
            <br className="hidden lg:block" />
            専門スタッフが丁寧にご説明いたします。
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Link
              href="/contact"
              className="px-12 py-6 bg-white text-emerald-600 rounded-full font-bold text-xl lg:text-2xl hover:shadow-xl transition-shadow flex items-center justify-center gap-3"
            >
              無料で相談する
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-4 text-white/90">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span className="text-2xl lg:text-3xl font-bold">090-3639-9477</span>
            <span className="text-lg lg:text-xl">（平日 9:00-18:00）</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactCTA;
