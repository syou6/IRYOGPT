import { ChatOpenAI } from '@langchain/openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI Credentials');
}

const DEFAULT_MODEL = 'gpt-5-mini';

export const openai = new ChatOpenAI({
  temperature: 1,
  modelName: DEFAULT_MODEL,
});

export const openaiStream = new ChatOpenAI({
  temperature: 1,
  modelName: DEFAULT_MODEL,
  streaming: true,
});
