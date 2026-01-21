-- Add office column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS office text;