export type SourceLink = {
  url: string;
  title?: string | null;
};

export type Message = {
  type: 'apiMessage' | 'userMessage';
  message: string;
  isStreaming?: boolean;
  /**
   * 旧来の参照リンク配列。ダッシュボードでは優先リンク(source)を使いつつ、
   * 後方互換性のために残しておく。
   */
  sources?: string[];
  /** 最も関連度が高い参照リンク */
  source?: SourceLink;
};
