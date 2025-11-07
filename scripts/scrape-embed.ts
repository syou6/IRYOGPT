import { Document } from '@langchain/core/dist/documents/index.js';
import * as fs from 'fs/promises';
import { CustomWebLoader } from '@/utils/custom_web_loader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/dist/vectorstores/supabase';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { supabaseClient } from '@/utils/supabase-client';
import { urls } from '@/config/notionurls';

async function extractDataFromUrl(url: string): Promise<Document[]> {
  try {
    const loader = new CustomWebLoader(url);
    const docs = await loader.load();
    return docs;
  } catch (error) {
    console.error(`Error while extracting data from ${url}: ${error}`);
    return [];
  }
}

async function extractDataFromUrls(urls: string[]): Promise<Document[]> {
  console.log('extracting data from urls...');
  const documents: Document[] = [];
  for (const url of urls) {
    const docs = await extractDataFromUrl(url);
    documents.push(...docs);
  }
  console.log('data extracted from urls');
  const json = JSON.stringify(documents);
  await fs.writeFile('franknotion.json', json);
  console.log('json file containing data saved on disk');
  return documents;
}

async function embedDocuments(
  client: SupabaseClient,
  docs: Document[],
  embeddings: OpenAIEmbeddings,
) {
  console.log('creating embeddings...');
  await SupabaseVectorStore.fromDocuments(docs, embeddings, {
    client,
    tableName: 'documents',
  });
  console.log('embeddings successfully stored in supabase');
}

async function splitDocsIntoChunks(docs: Document[]): Promise<Document[]> {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 200,
  });
  return await textSplitter.splitDocuments(docs);
}

(async function run(urls: string[]) {
  try {
    //load data from each url
    const rawDocs = await extractDataFromUrls(urls);
    //split docs into chunks for openai context window
    const docs = await splitDocsIntoChunks(rawDocs);
    //embed docs into supabase
    await embedDocuments(supabaseClient, docs, new OpenAIEmbeddings({ 
      model: 'text-embedding-3-small',
      dimensions: 512 
    }));
  } catch (error) {
    console.log('error occured:', error);
  }
})(urls);
