REVOKE EXECUTE ON FUNCTION public.tg_payment_default_pending() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_payment_guard_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_approve_payments(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_payments(UUID) TO authenticated;