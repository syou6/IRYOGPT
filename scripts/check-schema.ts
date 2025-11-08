import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env に設定してください');
}

const supabase = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function checkTableColumns(table: string, columns: string[]) {
  const { error } = await supabase.from(table).select(columns.join(', ')).limit(1);
  if (error) {
    throw new Error(`Table/columns check failed for ${table} (${columns.join(', ')}): ${error.message}`);
  }
  console.log(`✅ ${table}: ${columns.join(', ')}`);
}

async function main() {
  console.log('🔍 Checking schema via simple selects...');

  await checkTableColumns('users', ['id', 'plan', 'chat_quota', 'embedding_quota']);
  await checkTableColumns('sites', ['is_embed_enabled', 'embed_script_id']);
  await checkTableColumns('training_jobs', ['attempt', 'estimated_cost_usd']);
  await checkTableColumns('documents', ['version', 'valid_until']);
  await checkTableColumns('model_policies', ['id', 'name', 'type', 'cost_per_1000_tokens_usd']);

  console.log('\nAll expected tables/columns verified.');
}

main().catch((err) => {
  console.error('Schema check failed:', err);
  process.exit(1);
});
