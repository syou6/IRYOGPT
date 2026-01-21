import { motion } from "framer-motion";
import Image from "next/image";

const reasons = [
  {
    number: "01",
    image: "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?w=600&h=400&fit=crop",
    title: "AI×スプレッドシートで誰でも簡単運用",
    description: "特別なシステムは不要。使い慣れたGoogleスプレッドシートで予約を一元管理。AIが自動で予約を受け付け、スタッフの電話予約も同じシートに追加するだけ。",
  },
  {
    number: "02",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop",
    title: "圧倒的なコストパフォーマンス",
    description: "受付スタッフを1人雇用すると年間400万円以上。よやくらくなら年間150万円で24時間365日の予約対応を実現。年間250万円以上のコスト削減。",
  },
  {
    number: "03",
    image: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=600&h=400&fit=crop",
    title: "医療・美容業界に特化したAI",
    description: "医療アドバイスは一切行わず、予約と案内に特化。業界特有のニーズを理解し、担当医指名や診察券番号の確認にも対応します。",
  },
];

const ReasonsSection = () => {
  return (
    <section className="py-14 lg:py-24 bg-white">
      <div className="max-w-[1300px] lg:max-w-[1500px] 2xl:max-w-[1700px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <p className="text-lg lg:text-xl font-semibold text-emerald-600 mb-4 tracking-wide">WHY CHOOSE US</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            選ばれる <span className="text-emerald-500">3</span> つの理由
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {reasons.map((reason, index) => (
            <motion.div
              key={reason.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.12 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden group hover:shadow-xl transition-all duration-300"
            >
              <div className="relative">
                <Image
                  src={reason.image}
                  alt={reason.title}
                  width={600}
                  height={400}
                  className="w-full h-[180px] lg:h-[200px] object-cover"
                />
                <div className="absolute top-4 left-4 w-11 h-11 lg:w-12 lg:h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-[16px] lg:text-[18px] shadow-md">
                  {reason.number}
                </div>
              </div>
              <div className="p-8 lg:p-10">
                <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-5 leading-snug group-hover:text-emerald-600 transition-colors">
                  {reason.title}
                </h3>
                <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
                  {reason.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <a
            href="#features"
            className="inline-block px-7 py-3 border-2 border-emerald-500 text-emerald-600 rounded-full text-[14px] font-medium hover:bg-emerald-500 hover:text-white transition-colors"
          >
            詳しい機能を見る
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ReasonsSection;
