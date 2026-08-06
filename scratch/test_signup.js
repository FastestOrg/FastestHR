import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://swlknrfufxsvpkfulqcx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bGtucmZ1ZnhzdnBrZnVscWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjQ5NTIsImV4cCI6MjA4OTA0MDk1Mn0.rHNyaxpPkcGOcF3Z_0OKqFGFwDNQ95xao2RGkE9yR-Y";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("Attempting sign up...");
  try {
    const randomSuffix = Math.floor(Math.random() * 1000000);
    const email = `test-user-${randomSuffix}@example.com`;
    const password = "Password123!";
    
    console.log(`Using email: ${email}`);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: "Test User",
          platform_role: 'company_admin',
          company_name: `Test Company ${randomSuffix}`,
          company_size: "11-50",
          company_industry: "technology",
          company_country: "US",
        },
      },
    });
    
    if (error) {
      console.error("Sign up failed with error object:", error);
    } else {
      console.log("Sign up succeeded:", data);
    }
  } catch (err) {
    console.error("Unexpected error caught:", err);
  }
}

run();
