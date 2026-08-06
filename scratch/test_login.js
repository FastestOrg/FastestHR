import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://swlknrfufxsvpkfulqcx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bGtucmZ1ZnhzdnBrZnVscWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjQ5NTIsImV4cCI6MjA4OTA0MDk1Mn0.rHNyaxpPkcGOcF3Z_0OKqFGFwDNQ95xao2RGkE9yR-Y";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function check(email, password) {
  console.log(`Checking login for: ${email}`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    console.log(`Login failed for ${email}:`, error.message);
  } else {
    console.log(`Login succeeded for ${email}! User:`, data.user.id);
  }
}

async function run() {
  await check("test-user-512058@example.com", "Password123!");
  await check("test-user-standard-937613@example.com", "Password123!");
}

run();
