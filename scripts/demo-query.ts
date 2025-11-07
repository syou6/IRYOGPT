import { supabaseClient } from '@/utils/supabase-client';
import { SupabaseVectorStore } from '@langchain/community/dist/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';
// VectorDBQAChain is deprecated in LangChain 1.x, using makeChain instead
import { openai } from '@/utils/openai-client';

const query = 'How do i create a notion database?';

const model = openai;

async function searchForDocs() {
  const vectorStore = await SupabaseVectorStore.fromExistingIndex(
    supabaseClient,
    new OpenAIEmbeddings({ modelName: 'text-embedding-3-small' }),
  );

  /*uncomment below to test similarity search */
  //   const results = await vectorStore.similaritySearch(query, 2);

  //   console.log("results", results);

  const chain = VectorDBQAChain.fromLLM(model, vectorStore);

  //Ask a question
  const response = await chain.call({
    query: query,
  });

  console.log('response', response);
}

(async () => {
  await searchForDocs();
})();
