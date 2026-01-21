import { motion } from "framer-motion";
import Image from "next/image";

const steps = [
  {
    step: 1,
    title: "AIがチャットで対応",
    description: "患者様がHPのチャットで予約希望を伝えると、AIが空き状況を確認して予約を完了",
    image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=300&fit=crop",
  },
  {
    step: 2,
    title: "スプシに自動記録",
    description: "予約情報は即座にGoogleスプレッドシートに記録。スタッフの手動入力も反映",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop",
  },
  {
    step: 3,
    title: "スタッフが確認",
    description: "スタッフはスプシを見るだけで全予約を把握。スマホからも確認できます",
    image: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&h=300&fit=crop",
  },
];

const FlowSection = () => {
  return (
    <section id="flow" className="py-14 lg:py-24 bg-gray-50">
      <div className="max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <p className="text-lg lg:text-xl font-semibold text-emerald-600 mb-4 tracking-wide">HOW IT WORKS</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            シンプルな仕組み
          </h2>
          <p className="mt-6 text-xl lg:text-2xl text-gray-600">
            患者様とスタッフ、両方にとって使いやすい設計
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative rounded-2xl bg-white p-6 lg:p-8 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="absolute -top-4 left-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white text-[16px] font-bold shadow-md">
                  {item.step}
                </span>
              </div>
              <div className="mt-4">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100 mb-5">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={400}
                    height={300}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-4">
                  {item.title}
                </h3>
                <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Connector Lines (Desktop) */}
        <div className="hidden md:flex justify-center mt-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="w-24 lg:w-32 h-0.5 bg-emerald-200" />
              <div className="w-0 h-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-emerald-200" />
            </div>
            <div className="flex items-center">
              <div className="w-24 lg:w-32 h-0.5 bg-emerald-200" />
              <div className="w-0 h-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-emerald-200" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FlowSection;
