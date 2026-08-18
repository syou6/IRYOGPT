import { motion } from "framer-motion";
import Image from "next/image";

const reasons = [
  {
    number: "01",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop",
    title: "年間250万円の人件費削減を実現",
    description: "受付スタッフ1人の年間給与400万円が、よやくらくなら年間150万円で実現。初期費用は約2ヶ月で回収でき、以降は毎年250万円の経営効率化に直結します。",
  },
  {
    number: "02",
    image: "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?w=600&h=400&fit=crop",
    title: "導入3日で運用開始。システム導入の手間なし",
    description: "Googleスプレッドシート連携で、新しいシステム導入は不要。初期設定は当社が代行するため、スタッフの負担はゼロ。ITリテラシーを問わず、すぐに運用を開始できます。",
  },
  {
    number: "03",
    image: "https://images.unsplash.com/photo-1584982751601-97dcc096659c?w=600&h=400&fit=crop",
    title: "予約と案内に専門化した安全なAI",
    description: "医療判断は一切行わず、予約と案内業務に特化。担当医指名や診察券番号の確認にも対応し、医院の実務フローに最適化された安全設計です。",
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
