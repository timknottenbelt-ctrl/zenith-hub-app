-- Add existing user as admin
INSERT INTO public.user_roles (user_id, role, approved_at)
VALUES ('4955f053-c1ac-4de1-986f-ad432239cacb', 'admin', now())
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', approved_at = now();