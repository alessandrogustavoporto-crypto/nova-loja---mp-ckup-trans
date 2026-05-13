const SUPABASE_URL = 'https://kakeytwbtnwbkofintuh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtha2V5dHdidG53YmtvZmludHVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODM3NjYsImV4cCI6MjA5MzE1OTc2Nn0.6mDIto6yuhcFDm7R-QKR3M3IcgeMdCykDkNUH8MFc5M';

fetch(SUPABASE_URL + '/rest/v1/store_settings?select=*', {
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
    }
})
.then(res => res.json())
.then(data => console.log('DB data:', data))
.catch(err => console.error(err));
