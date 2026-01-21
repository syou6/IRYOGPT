import { motion } from "framer-motion";
import Image from "next/image";

const banners = [
  {
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop",
    alt: "歯科医院",
  },
  {
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&h=300&fit=crop",
    alt: "クリニック受付",
  },
  {
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop",
    alt: "医療スタッフ",
  },
  {
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&h=300&fit=crop",
    alt: "予約システム",
  },
];

const FeatureBanners = () => {
  return (
    <section className="py-10 lg:py-16 bg-white">
      <div className="max-w-[1300px] lg:max-w-[1500px] 2xl:max-w-[1700px] mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6"
        >
          {banners.map((banner, index) => (
            <motion.div
              key={banner.alt}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="overflow-hidden rounded-2xl bg-gray-100 shadow-sm hover:shadow-lg transition-shadow"
            >
              <Image
                src={banner.image}
                alt={banner.alt}
                width={400}
                height={300}
                className="h-36 lg:h-48 w-full object-cover transition-transform hover:scale-105"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeatureBanners;
