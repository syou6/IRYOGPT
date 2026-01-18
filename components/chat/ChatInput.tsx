import * as React from "react";
import { useChatSubmit } from "use-chat-submit";

type ChatInputProps = {
  onSubmit: (value: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  disabled,
  placeholder = "質問を入力してください...",
  value,
  onChange,
  className = "",
}) => {
  const {
    getTextareaProps,
    triggerSubmit,
    textareaRef,
  } = useChatSubmit({
    mode: "mod-enter", // Cmd/Ctrl+Enter で送信 / Enter は改行（日本語向け推奨）
    onSubmit: async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      await onSubmit(trimmed);
      onChange(""); // 送信後クリア
      // 送信後にフォーカスを戻す
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    },
    // allowEmptySubmit: false がデフォルトなので、空文字は送信されない
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        triggerSubmit(); // ボタン押下時も同じロジックを通す
      }}
      className={`flex flex-col gap-3 sm:flex-row ${className}`}
    >
      <div className="flex-1 rounded-2xl border border-premium-stroke bg-premium-surface px-4 py-3
                      shadow-[0_15px_35px_rgba(0,0,0,0.08)] backdrop-blur-sm
                      focus-within:border-emerald-400/70 focus-within:ring-2 focus-within:ring-emerald-400/70
                      transition">
        <textarea
          {...getTextareaProps({
            value,
            onChange: (e) => onChange(e.target.value),
            placeholder,
            rows: 2,
            className:
              "w-full resize-none border-none bg-transparent text-sm text-premium-text " +
              "placeholder:text-premium-muted outline-none",
            disabled,
          })}
          ref={textareaRef as React.Ref<HTMLTextAreaElement>}
        />
      </div>
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300 
                   px-6 py-3 text-sm font-semibold text-slate-900 
                   shadow-[0_20px_45px_rgba(16,185,129,0.35)] 
                   transition hover:-translate-y-0.5 
                   disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
      >
        送信
      </button>
      <p className="text-xs text-premium-muted sm:col-span-2 sm:mt-0 mt-[-8px]">
        Cmd/Ctrl + Enter で送信 · Enter で改行
      </p>
    </form>
  );
};

