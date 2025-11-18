import { ChatOpenAI } from '@langchain/openai';
// @ts-ignore - LangChain 1.x module resolution issue
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import { CallbackManager } from '@langchain/core/callbacks/manager';

// Document配列を文字列に変換する関数
const formatDocumentsAsString = (documents: Document[]): string => {
  return documents.map((doc) => doc.pageContent).join('\n\n');
};

const CONDENSE_PROMPT = PromptTemplate.fromTemplate(
  `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`
);

const QA_PROMPT = PromptTemplate.fromTemplate(
  `あなたは本サービスの公式AIコンシェルジュです。訪問者に丁寧に挨拶し、会社の強みや信頼性をわかりやすく伝え、次に取るべきアクションを提案してください。

トーンの指針:
- 誠実であたたかく、プロフェッショナルな口調。
- 会社の価値や実績をさりげなく示し、ブランドイメージを高める。
- コンテキストが少ない場合でも、問い合わせフォームやデモ・資料など、次に取れるステップを必ず提案する。
- 質問と同じ言語（通常は日本語）で回答し、Markdown で整理する。

以下のコンテキストを参考に、事実ベースで回答してください。不明点はその旨を伝えつつ、どのように確認すべきか案内しましょう。

Question: {question}
=========
{context}
=========
Answer in Markdown:`
);

export const makeChain = (
  vectorstore: SupabaseVectorStore,
  onTokenStream?: (token: string) => void,
  retriever?: any,
) => {
  // 質問生成用のLLM
  const questionGenerator = new ChatOpenAI({
    temperature: 1,
    model: 'gpt-5-mini',
  });

  // 回答生成用のLLM（ストリーミング対応）
  const answerLLM = new ChatOpenAI({
    temperature: 1,
    model: 'gpt-5-mini',
    streaming: Boolean(onTokenStream),
    callbacks: onTokenStream ? CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        if (onTokenStream) {
          onTokenStream(token);
        }
      },
    }) : undefined,
  });

  // 質問を独立した質問に変換するチェーン
  const condenseQuestionChain = CONDENSE_PROMPT.pipe(questionGenerator as any).pipe(new StringOutputParser());

  // 回答生成チェーン
  const answerChain = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        (input: { question: string }) => input.question,
        retriever || (vectorstore as any).asRetriever(),
        formatDocumentsAsString,
      ]),
      question: (input: { question: string }) => input.question,
    },
    QA_PROMPT,
    answerLLM as any,
    new StringOutputParser(),
  ] as any);

  // メインチェーン：会話履歴がある場合は質問を変換、ない場合はそのまま使用
  return RunnableSequence.from([
    {
      question: (input: { question: string; chat_history: [string, string][] }) => {
        if (input.chat_history && input.chat_history.length > 0) {
          return condenseQuestionChain.invoke({
            question: input.question,
            chat_history: input.chat_history
              .map(([q, a]) => `Human: ${q}\nAssistant: ${a}`)
              .join('\n'),
          });
        }
        return input.question;
      },
    },
    answerChain,
  ] as any);
};
