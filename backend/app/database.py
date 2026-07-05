from supabase import create_client, Client
from app.config import settings

# Initialize Supabase client
# We use the service role key to perform operations with admin privileges,
# as auth and permission checks are handled directly by the FastAPI backend.
supabase_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
if not supabase_key:
    raise ValueError("Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY) is required!")

supabase: Client = create_client(settings.SUPABASE_URL, supabase_key)
