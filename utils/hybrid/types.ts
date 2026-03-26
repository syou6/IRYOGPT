/**
 * ハイブリッドモード用の型定義
 */

export interface HybridChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface HybridChatResult {
  message: string;
  toolCalls?: any[];
  appointmentCreated?: boolean;
  ragContext?: string;
}
