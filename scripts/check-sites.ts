import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseClient } from '../utils/supabase-client';

async function check() {
  const { data, error } = await supabaseClient
    .from('sites')
    .select('id, name, chat_mode, spreadsheet_id, status')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Sites:');
  for (const site of data || []) {
    console.log('---');
    console.log('ID:', site.id);
    console.log('Name:', site.name);
    console.log('Mode:', site.chat_mode);
    console.log('Spreadsheet:', site.spreadsheet_id || '(未設定)');
    console.log('Status:', site.status);
  }
}

check();
