import { motion } from "framer-motion";
import Image from "next/image";

const features = [
  {
    icon: "https://img.icons8.com/3d-fluency/94/robot-2.png",
    title: "会話で完結するAI予約受付",
    description: "フォーム入力不要。患者様が話しかけるだけで、AIが空き状況を確認し予約を完結します。夜間・休診日も自動対応で、予約の取りこぼしをゼロに。",
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/bar-chart.png",
    title: "既存業務フローをそのまま維持",
    description: "新しいシステムを覚える必要はゼロ。使い慣れたGoogleスプレッドシートで全予約を一元管理。スタッフの電話予約も同じシートに追加するだけです。",
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/globe.png",
    title: "「よくある質問」電話を8割削減",
    description: "診療時間・アクセス・料金・保険適用など、繰り返しかかってくる問い合わせ電話にも自動回答。スタッフは本当に必要な対応だけに集中できます。",
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/line-me.png",
    title: "LINEから直接予約が完結",
    description: "患者様が普段使いのLINEで予約できるため、利用率が大幅に向上。アプリ不要で、シニア世代の患者様にも使いやすい導線を実現します。",
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
            受付業務の手間を削減し、院内の時間とコストを生み出す4つの機能
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
