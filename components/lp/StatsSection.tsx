import { motion } from "framer-motion";

const StatsSection = () => {
  return (
    <section className="py-14 lg:py-20 bg-white">
      <div className="max-w-[1000px] mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-[12px] lg:text-[14px] text-gray-500 mb-2">導入による効果</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-[56px] lg:text-[80px] font-bold text-emerald-500 leading-none">250</span>
              <span className="text-[20px] lg:text-[24px] font-bold text-gray-900">万円/年 削減!</span>
            </div>
            <p className="text-[13px] lg:text-[15px] text-gray-600 leading-relaxed">
              受付スタッフ1人分の人件費を
              <br />
              AI予約システムで削減できます。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="bg-emerald-50 rounded-2xl p-5 lg:p-6 text-center">
              <div className="text-[36px] lg:text-[48px] font-bold text-emerald-500 leading-none mb-1">80%</div>
              <p className="text-[12px] lg:text-[13px] text-gray-600">電話対応削減</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-5 lg:p-6 text-center">
              <div className="text-[36px] lg:text-[48px] font-bold text-emerald-500 leading-none mb-1">24h</div>
              <p className="text-[12px] lg:text-[13px] text-gray-600">365日対応</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-5 lg:p-6 text-center">
              <div className="text-[36px] lg:text-[48px] font-bold text-emerald-500 leading-none mb-1">30%</div>
              <p className="text-[12px] lg:text-[13px] text-gray-600">予約数アップ</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-5 lg:p-6 text-center">
              <div className="text-[36px] lg:text-[48px] font-bold text-emerald-500 leading-none mb-1">10日</div>
              <p className="text-[12px] lg:text-[13px] text-gray-600">で導入可能</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
