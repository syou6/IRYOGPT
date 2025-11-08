import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/utils/supabase-auth';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string; // ターゲット要素のIDまたはセレクタ
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'ようこそ SiteGPT へ',
    description: 'ここでは、学習させたいURLを登録しておくだけでOKです。学習と埋め込み設定はチームが代行します。',
    position: 'bottom',
  },
  {
    id: 'create-site',
    title: '情報を登録',
    description: '「+ 新規サイト登録」からサイト名とベースURL・追加したいページを入力してください。',
    target: 'onboarding-create-site-btn',
    position: 'bottom',
  },
  {
    id: 'start-training',
    title: '依頼を送信',
    description: '登録後はステータスが「未学習」になります。学習ボタンは運営側で操作するので、そのままで大丈夫です。',
    target: 'onboarding-start-training-btn',
    position: 'top',
  },
  {
    id: 'chat',
    title: '進捗を確認',
    description: '学習完了後はこちらで「チャット開始」がアクティブになり、埋め込みスクリプトもチームから共有されます。',
    target: 'onboarding-chat-btn',
    position: 'top',
  },
];

export default function Onboarding({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
  const supabase = createSupabaseClient();

  useEffect(() => {
    // オンボーディング完了済みかチェック
    const checkOnboardingStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const completed = localStorage.getItem(`onboarding_completed_${session.user.id}`);
      if (completed === 'true') {
        onComplete();
        return;
      }

      // 少し遅延してから表示（UIが読み込まれるのを待つ）
      setTimeout(() => {
        setIsVisible(true);
      }, 500);
    };

    checkOnboardingStatus();
  }, [supabase, onComplete]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      localStorage.setItem(`onboarding_completed_${session.user.id}`, 'true');
    }

    setIsVisible(false);
    onComplete();
  };

  const step = ONBOARDING_STEPS[currentStep];

  useEffect(() => {
    if (!step.target) {
      setPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    const targetElement = document.getElementById(step.target) || document.querySelector(step.target);
    if (!targetElement) {
      setPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      return;
    }

    const updatePosition = () => {
      const rect = targetElement.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      let newTop = '50%';
      let newLeft = '50%';
      let newTransform = 'translate(-50%, -50%)';

      switch (step.position) {
        case 'top':
          newTop = `${rect.top + scrollY - 10}px`;
          newLeft = `${rect.left + scrollX + rect.width / 2}px`;
          newTransform = 'translate(-50%, -100%)';
          break;
        case 'bottom':
          newTop = `${rect.bottom + scrollY + 10}px`;
          newLeft = `${rect.left + scrollX + rect.width / 2}px`;
          newTransform = 'translate(-50%, 0)';
          break;
        case 'left':
          newTop = `${rect.top + scrollY + rect.height / 2}px`;
          newLeft = `${rect.left + scrollX - 10}px`;
          newTransform = 'translate(-100%, -50%)';
          break;
        case 'right':
          newTop = `${rect.top + scrollY + rect.height / 2}px`;
          newLeft = `${rect.right + scrollX + 10}px`;
          newTransform = 'translate(0, -50%)';
          break;
      }

      setPosition({ top: newTop, left: newLeft, transform: newTransform });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [step.target, step.position, currentStep]);

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* ツールチップ */}
      <div
        className="fixed z-50 w-11/12 max-w-sm rounded-[28px] border border-white/10 bg-gradient-to-b from-[#08131d] via-[#050b12] to-[#030508] p-4 text-slate-100 shadow-[0_35px_120px_rgba(1,5,3,0.65)] md:p-6"
        style={{
          top: position.top,
          left: position.left,
          transform: position.transform,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ステップインジケーター */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {ONBOARDING_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full ${
                  index === currentStep
                    ? 'bg-emerald-400'
                    : index < currentStep
                    ? 'bg-emerald-200'
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="text-slate-500 hover:text-slate-300 text-xl font-bold"
            aria-label="スキップ"
          >
            ×
          </button>
        </div>

        {/* コンテンツ */}
        <h3 className="mb-2 text-lg font-semibold text-white md:text-xl">{step.title}</h3>
        <p className="mb-4 text-sm text-slate-300 md:text-base">{step.description}</p>

        {/* 矢印（ターゲット要素がある場合） */}
        {step.target && step.position && (
          <div
            className={`absolute h-0 w-0 border-8 ${
              step.position === 'top'
                ? 'bottom-full left-1/2 -translate-x-1/2 border-t-emerald-400 border-r-transparent border-b-transparent border-l-transparent'
                : step.position === 'bottom'
                ? 'top-full left-1/2 -translate-x-1/2 border-b-emerald-400 border-r-transparent border-t-transparent border-l-transparent'
                : step.position === 'left'
                ? 'right-full top-1/2 -translate-y-1/2 border-l-emerald-400 border-t-transparent border-r-transparent border-b-transparent'
                : 'left-full top-1/2 -translate-y-1/2 border-r-emerald-400 border-t-transparent border-l-transparent border-b-transparent'
            }`}
          />
        )}

        {/* ボタン */}
        <div className="flex gap-2 justify-end">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
            >
              戻る
            </button>
          )}
          <button
            onClick={handleNext}
            className="rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_15px_35px_rgba(16,185,129,0.35)]"
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? '完了' : '次へ'}
          </button>
        </div>
      </div>
    </>
  );
}
