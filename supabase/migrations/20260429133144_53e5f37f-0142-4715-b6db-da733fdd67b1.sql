ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'payment_approver';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending_approval';