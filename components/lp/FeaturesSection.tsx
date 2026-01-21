import { motion } from "framer-motion";
import Image from "next/image";

const features = [
  {
    icon: "https://img.icons8.com/3d-fluency/94/robot-2.png",
    title: "24時間自動予約受付",
    description: "AIが24時間365日、自然な会話で予約を受け付け。夜間や休診日も予約を逃しません。",
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/bar-chart.png",
    title: "スプレッドシート連携",
    description: "Googleスプレッドシートで予約を一元管理。既存の業務フローを変えずに導入できます。",
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/globe.png",
    title: "HP情報も自動回答",
    description: "診療時間、アクセス、料金などのよくある質問にも自動で回答。電話を減らします。",
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/stethoscope.png",
    title: "担当医指名・診察券対応",
    description: "担当医の指名予約や診察券番号の確認も対応。再診患者にも安心の体験を。",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-14 lg:py-24 bg-white">
      <div className="max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <p className="text-lg lg:text-xl font-semibold text-emerald-600 mb-4 tracking-wide">FEATURES</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            よやくらくの機能
          </h2>
          <p className="mt-6 text-xl lg:text-2xl text-gray-600">
            AI予約システムで業務効率を劇的に改善
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="rounded-3xl border border-gray-200 bg-white p-10 lg:p-12 shadow-sm hover:shadow-xl transition-shadow"
            >
              <Image
                src={feature.icon}
                alt={feature.title}
                width={94}
                height={94}
                className="mb-6"
              />
              <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-5">
                {feature.title}
              </h3>
              <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
