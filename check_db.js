import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Manually parse .env
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL || '',
  env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);

async function check() {
  console.log('Querying companies...');
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, slug, custom_domain, is_active, deleted_at');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Companies:', JSON.stringify(data, null, 2));
  }

  console.log('Querying public_companies view...');
  const { data: viewData, error: viewError } = await supabase
    .from('public_companies')
    .select('id, name, slug, custom_domain');
  
  if (viewError) {
    console.error('View Error:', viewError);
  } else {
    console.log('Public Companies (view):', JSON.stringify(viewData, null, 2));
  }
}

check();
