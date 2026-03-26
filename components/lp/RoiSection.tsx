"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const YOYAKURAKU_INITIAL = 300_000;
const YOYAKURAKU_MONTHLY = 100_000;
const YOYAKURAKU_ANNUAL = YOYAKURAKU_INITIAL + YOYAKURAKU_MONTHLY * 12;

const SALARY_OPTIONS = [
  { label: "¥300万", value: 3_000_000 },
  { label: "¥350万", value: 3_500_000 },
  { label: "¥400万", value: 4_000_000 },
];

const formatManyen = (yen: number) => {
  const man = Math.round(yen / 10_000);
  return `${man.toLocaleString()}万円`;
};

const RoiSection = () => {
  const [receptionists, setReceptionists] = useState(1);
  const [salaryIndex, setSalaryIndex] = useState(1); // default ¥350万

  const salary = SALARY_OPTIONS[salaryIndex].value;

  const { staffCost, savings, savingsMin, savingsMax } = useMemo(() => {
    const socialInsuranceRate = 0.15; // 約15%（社会保険料・雇用保険等の事業主負担）
    const totalSalary = salary * receptionists;
    const cost = Math.round(totalSalary * (1 + socialInsuranceRate));
    const sav = cost - YOYAKURAKU_ANNUAL;
    const savMin = Math.round(3_000_000 * receptionists * 1.15) - YOYAKURAKU_ANNUAL;
    const savMax = Math.round(4_000_000 * receptionists * 1.15) - YOYAKURAKU_ANNUAL;
    return { staffCost: cost, savings: sav, savingsMin: savMin, savingsMax: savMax };
  }, [receptionists, salary]);

  const staffBarPercent = Math.min(100, 100);
  const yoyakuBarPercent = Math.round((YOYAKURAKU_ANNUAL / staffCost) * 100);

  return (
    <section id="roi" className="py-14 lg:py-24 bg-gray-50">
      <div className="max-w-[1100px] lg:max-w-[1300px] 2xl:max-w-[1500px] mx-auto px-4 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14 lg:mb-20"
        >
          <p className="text-lg lg:text-xl font-semibold text-emerald-600 mb-4 tracking-wide">ROI CALCULATOR</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            コスト削減額を<span className="text-emerald-500">計算</span>する
          </h2>
          <p className="mt-6 text-xl lg:text-2xl text-gray-600">
            受付スタッフ1人分の半額以下で、24時間365日対応
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">

          {/* Left: Controls */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl shadow-lg p-6 lg:p-8"
          >
            <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-8">現在のスタッフ状況を入力</h3>

            {/* Receptionists slider */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <label className="text-base lg:text-lg font-semibold text-gray-700">
                  受付スタッフ人数
                </label>
                <span className="text-2xl lg:text-3xl font-bold text-emerald-600">
                  {receptionists}名
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={receptionists}
                onChange={(e) => setReceptionists(Number(e.target.value))}
                className="w-full h-2 bg-emerald-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-sm text-gray-400 mt-1">
                <span>1名</span>
                <span>2名</span>
                <span>3名</span>
              </div>
            </div>

            {/* Salary selector */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <label className="text-base lg:text-lg font-semibold text-gray-700">
                  スタッフ1人あたり年収
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {SALARY_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.value}
                    onClick={() => setSalaryIndex(i)}
                    className={`py-3 rounded-xl font-bold text-base lg:text-lg transition-all duration-200 border-2 ${
                      salaryIndex === i
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                        : "bg-white border-gray-200 text-gray-700 hover:border-emerald-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Yoyakuraku fixed cost display */}
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-sm text-emerald-700 font-semibold mb-1">よやくらく 年間コスト</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">{formatManyen(YOYAKURAKU_ANNUAL)}</span>
                <span className="text-sm text-emerald-600 opacity-80">（初期30万 + 月額10万×12）</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Results */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-6"
          >

            {/* Savings highlight */}
            <div className="bg-emerald-500 rounded-2xl shadow-xl p-6 lg:p-8 text-white">
              <p className="text-base lg:text-lg font-semibold opacity-90 mb-2">年間コスト削減額</p>
              <motion.div
                key={savings}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-baseline gap-2 mb-3"
              >
                <span className="text-5xl lg:text-6xl font-bold leading-none tracking-tight">
                  {formatManyen(savings)}
                </span>
                <span className="text-xl font-semibold opacity-80">/年 節約</span>
              </motion.div>
              <p className="text-sm opacity-80">
                ※ 社会保険料等（事業主負担約15%）を含む試算
              </p>
            </div>

            {/* Bar comparison */}
            <div className="bg-white rounded-2xl shadow-lg p-6 lg:p-8">
              <h4 className="text-base lg:text-lg font-bold text-gray-700 mb-6">年間コスト比較</h4>

              {/* Staff cost bar */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm lg:text-base font-semibold text-gray-600">
                    受付スタッフ {receptionists}名（現状）
                  </span>
                  <span className="text-base lg:text-lg font-bold text-gray-900">
                    {formatManyen(staffCost)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                  <motion.div
                    className="h-5 bg-gray-400 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${staffBarPercent}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Yoyakuraku bar */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm lg:text-base font-semibold text-emerald-600">
                    よやくらく（AI対応）
                  </span>
                  <span className="text-base lg:text-lg font-bold text-emerald-600">
                    {formatManyen(YOYAKURAKU_ANNUAL)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                  <motion.div
                    className="h-5 bg-emerald-500 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${yoyakuBarPercent}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    key={yoyakuBarPercent}
                  />
                </div>
              </div>

              {/* Savings badge */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm lg:text-base text-emerald-800 font-semibold leading-snug">
                    削減額{" "}
                    <span className="text-emerald-600 font-bold">
                      {formatManyen(savingsMin)}〜{formatManyen(savingsMax)}
                    </span>
                    ／年（年収水準による）
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom perks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-10 grid sm:grid-cols-3 gap-4"
        >
          {[
            { icon: "🌙", title: "夜間・休日も無休", body: "人間と違い、深夜・祝日も同じ品質で予約対応。機会損失ゼロ。" },
            { icon: "🤒", title: "病欠・採用コストなし", body: "突然の欠勤や離職で頭を悩ませることがなくなります。" },
            { icon: "📈", title: "対応品質が安定", body: "繁忙期も閑散期も、常に同じ応答品質を維持します。" },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * i }}
              className="bg-white rounded-2xl shadow p-5 lg:p-6 flex gap-4 items-start"
            >
              <span className="text-3xl leading-none">{item.icon}</span>
              <div>
                <p className="font-bold text-gray-900 mb-1 text-base">{item.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center"
        >
          <Link
            href="/contact"
            className="inline-block px-10 py-4 bg-emerald-500 text-white rounded-full font-bold text-lg lg:text-xl hover:bg-emerald-600 transition-colors shadow-lg"
          >
            無料相談で詳しく試算する
          </Link>
          <p className="mt-3 text-sm text-gray-500">相談無料・お見積り無料</p>
        </motion.div>

      </div>
    </section>
  );
};

export default RoiSection;
