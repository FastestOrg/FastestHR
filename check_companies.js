const url = "https://swlknrfufxsvpkfulqcx.supabase.co/rest/v1/companies";
const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bGtucmZ1ZnhzdnBrZnVscWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjQ5NTIsImV4cCI6MjA4OTA0MDk1Mn0.rHNyaB8-c3V5C2fD-nix-fLdJ0y3GskQhY3_t13bYvY";

fetch(url, {
  method: 'OPTIONS',
  headers: {
    'apikey': apikey,
    'Authorization': `Bearer ${apikey}`
  }
})
.then(res => res.json())
.then(data => {
  const definition = data.definitions?.companies;
  if (definition) {
    console.log("Columns:", Object.keys(definition.properties));
  } else {
    console.log("Response:", data);
  }
})
.catch(err => console.error("Error:", err));
