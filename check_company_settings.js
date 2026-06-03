const url = "https://swlknrfufxsvpkfulqcx.supabase.co/rest/v1/companies?select=id,name,geofence_latitude,geofence_longitude,geofence_radius,attendance_settings&limit=3";
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
  console.log("Companies:", JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
