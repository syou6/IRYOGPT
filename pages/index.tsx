import Head from 'next/head';
import Header from '@/components/lp/Header';
import HeroSection from '@/components/lp/HeroSection';
import FeatureBanners from '@/components/lp/FeatureBanners';
import ClientLogos from '@/components/lp/ClientLogos';
import CampaignBanner from '@/components/lp/CampaignBanner';
import ReasonsSection from '@/components/lp/ReasonsSection';
import DepartmentsSection from '@/components/lp/DepartmentsSection';
import BeforeAfterSection from '@/components/lp/BeforeAfterSection';
import ContactCTA from '@/components/lp/ContactCTA';
import FeaturesSection from '@/components/lp/FeaturesSection';
import PricingSection from '@/components/lp/PricingSection';
import SupportSection from '@/components/lp/SupportSection';
import FlowSection from '@/components/lp/FlowSection';
import VisionSection from '@/components/lp/VisionSection';
import FAQSection from '@/components/lp/FAQSection';
import Footer from '@/components/lp/Footer';
import FloatingButtons from '@/components/lp/FloatingButtons';

export default function Home() {
  return (
    <>
      <Head>
        <title>よやくらく | 医療・美容業界特化 AI予約システム</title>
        <meta name="description" content="24時間365日AIが予約を自動受付。予約対応の人件費を年間250万円削減。医療機関・サロン向けのAI予約チャットボット。" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

        {/* OGP */}
        <meta property="og:title" content="よやくらく | 医療・美容業界特化 AI予約システム" />
        <meta property="og:description" content="24時間365日AIが予約を自動受付。予約対応の人件費を年間250万円削減。" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="ja_JP" />
      </Head>

      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <HeroSection />
          <FeatureBanners />
          <ClientLogos />
          <CampaignBanner />
          <ReasonsSection />
          <DepartmentsSection />
          <BeforeAfterSection />
          <ContactCTA variant="simple" />
          <FeaturesSection />
          <PricingSection />
          <ContactCTA variant="simple" />
          <SupportSection />
          <FlowSection />
          <VisionSection />
          <FAQSection />
          <ContactCTA />
        </main>
        <Footer />
        <FloatingButtons />
      </div>
    </>
  );
}
