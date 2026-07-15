const url = "https://swlknrfufxsvpkfulqcx.supabase.co/rest/v1/attendance?select=id,status,clock_in,clock_out,date&limit=10";
const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3bGtucmZ1ZnhzdnBrZnVscWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjQ5NTIsImV4cCI6MjA4OTA0MDk1Mn0.rHNyaxpPkcGOcF3Z_0OKqFGFwDNQ95xao2RGkE9yR-Y";

fetch(url, {
  method: "GET",
  headers: {
    "apikey": apikey,
    "Authorization": `Bearer ${apikey}`
  }
})
.then(res => res.json())
.then(data => {
  console.log("Attendance records:", JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
