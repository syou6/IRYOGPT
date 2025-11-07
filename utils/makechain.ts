import { ChatOpenAI } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/dist/vectorstores/supabase';
import { PromptTemplate } from '@langchain/core/dist/prompts/index.js';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/dist/runnables/index.js';
import { StringOutputParser } from '@langchain/core/dist/output_parsers/index.js';
import { Document } from '@langchain/core/dist/documents/index.js';

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
  `You are a helpful AI assistant. You are given the following extracted parts of a long document and a question. Provide a conversational answer based on the context provided.

Instructions:
- Answer in Japanese if the question is in Japanese, otherwise answer in the same language as the question.
- Use the context provided below to answer the question as accurately as possible.
- If the context contains relevant information, use it to provide a helpful answer.
- If the context doesn't contain enough information to fully answer the question, you can say "提供された情報だけでは完全に答えられませんが、" and provide what you can infer from the context.
- Only use hyperlinks as references that are explicitly listed as a source in the context below. Do NOT make up a hyperlink that is not listed below.
- If the context is completely irrelevant to the question, you can say "申し訳ございませんが、提供された情報からは質問にお答えできません。"

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
    temperature: 0,
    model: 'gpt-4o-mini',
  });

  // 回答生成用のLLM（ストリーミング対応）
  const answerLLM = new ChatOpenAI({
    temperature: 0,
    model: 'gpt-4o-mini',
    streaming: Boolean(onTokenStream),
  });

  // 質問を独立した質問に変換するチェーン
  const condenseQuestionChain = RunnableSequence.from([
    CONDENSE_PROMPT,
    questionGenerator,
    new StringOutputParser(),
  ]);

  // 回答生成チェーン
  const answerChain = RunnableSequence.from([
    {
      context: RunnableSequence.from([
        (input: { question: string }) => input.question,
        retriever || vectorstore.asRetriever(),
        formatDocumentsAsString,
      ]),
      question: (input: { question: string }) => input.question,
    },
    QA_PROMPT,
    answerLLM,
    new StringOutputParser(),
  ]);

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
  ]);
};
