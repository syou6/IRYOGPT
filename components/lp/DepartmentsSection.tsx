import { motion } from "framer-motion";
import Image from "next/image";

const departments = [
  {
    icon: "https://img.icons8.com/3d-fluency/94/tooth.png",
    name: "歯科医院"
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/hospital-2.png",
    name: "クリニック"
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/hand.png",
    name: "整骨院・接骨院"
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/spa.png",
    name: "エステサロン"
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/lipstick.png",
    name: "ネイルサロン"
  },
  {
    icon: "https://img.icons8.com/3d-fluency/94/hair-dryer.png",
    name: "美容室"
  },
];

const DepartmentsSection = () => {
  return (
    <section id="departments" className="py-14 lg:py-24 bg-gray-50">
      <div className="max-w-[1200px] lg:max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            対象業種
          </h2>
          <p className="mt-6 text-xl lg:text-2xl text-gray-600">
            予約管理が必要なあらゆる業種に対応
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 lg:gap-6">
          {departments.map((dept, index) => (
            <motion.div
              key={dept.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col items-center rounded-2xl bg-white p-5 lg:p-6 shadow-sm hover:shadow-lg transition-shadow"
            >
              <Image
                src={dept.icon}
                alt={dept.name}
                width={56}
                height={56}
                className="mb-3"
              />
              <span className="text-lg lg:text-xl font-semibold text-gray-800 text-center">
                {dept.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DepartmentsSection;
