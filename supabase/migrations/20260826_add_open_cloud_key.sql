-- Add Open Cloud API key field to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS open_cloud_api_key TEXT;
