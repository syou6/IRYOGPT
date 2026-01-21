const clients = [
  "さくら歯科",
  "青山クリニック",
  "田中整骨院",
  "美容室 HAIR",
  "渋谷皮膚科",
  "Nail Salon M",
  "新宿内科",
  "エステ LUXE",
];

const ClientLogos = () => {
  return (
    <section className="py-10 lg:py-14 bg-gray-50">
      <div className="max-w-[1300px] lg:max-w-[1500px] 2xl:max-w-[1700px] mx-auto px-4 lg:px-8">
        <p className="text-center text-[14px] lg:text-[16px] text-gray-500 mb-8">
          多くの医療機関・サロンで導入いただいています
        </p>

        <div className="relative overflow-hidden">
          {/* Gradient overlays */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-gradient-to-r from-gray-50 to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-gradient-to-l from-gray-50 to-transparent" />

          {/* Scrolling logos */}
          <div className="flex animate-scroll">
            {[...Array(2)].map((_, setIndex) => (
              <div key={setIndex} className="flex shrink-0 items-center gap-8 px-4">
                {clients.map((name) => (
                  <div
                    key={`${setIndex}-${name}`}
                    className="flex h-16 w-40 items-center justify-center rounded-lg bg-white px-4 shadow-sm"
                  >
                    <span className="text-[14px] lg:text-[16px] font-bold text-gray-400">{name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientLogos;
