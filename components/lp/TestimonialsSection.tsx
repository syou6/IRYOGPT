import { motion } from "framer-motion";

const testimonials = [
  {
    name: "A歯科クリニック",
    role: "院長",
    category: "歯科医院",
    quote: "電話対応に追われていた受付スタッフが、今では患者さんのケアに集中できるようになりました。夜間の予約も自動で入るので、朝出勤するとスプレッドシートに予約が並んでいるのは感動しました。",
    metric: "電話対応 75%削減",
  },
  {
    name: "B皮膚科クリニック",
    role: "事務長",
    category: "クリニック",
    quote: "導入前は1日30件以上の電話対応で、診療時間にも影響が出ていました。今はAIが一次対応してくれるので、本当に必要な問い合わせだけに集中できます。スタッフの残業もほぼゼロになりました。",
    metric: "月間予約数 +40%",
  },
  {
    name: "C美容サロン",
    role: "オーナー",
    category: "美容サロン",
    quote: "施術中に電話が鳴るたびに手を止めていたのがなくなりました。お客様にも『LINEみたいに予約できて便利』と好評です。導入も3日で完了して、ITが苦手な私でもまったく問題なかったです。",
    metric: "施術中の中断 ゼロ",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-14 lg:py-24 bg-gray-50">
      <div className="max-w-[1300px] lg:max-w-[1500px] 2xl:max-w-[1700px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <p className="text-lg lg:text-xl font-semibold text-emerald-600 mb-4 tracking-wide">VOICE</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            導入医院の声
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.12 }}
              className="bg-white rounded-2xl p-8 lg:p-10 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                  {item.category}
                </span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-bold">
                  {item.metric}
                </span>
              </div>

              <p className="text-lg lg:text-xl text-gray-700 leading-relaxed mb-8">
                &ldquo;{item.quote}&rdquo;
              </p>

              <div className="border-t pt-5">
                <p className="text-base font-bold text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500">{item.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
