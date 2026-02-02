-- Add OTP verification columns to contract_signatories
ALTER TABLE public.contract_signatories
ADD COLUMN otp_code TEXT,
ADD COLUMN otp_expires_at TIMESTAMPTZ,
ADD COLUMN otp_verified_at TIMESTAMPTZ;

-- Add comment explaining the columns
COMMENT ON COLUMN public.contract_signatories.otp_code IS 'Hashed OTP code for email verification';
COMMENT ON COLUMN public.contract_signatories.otp_expires_at IS 'OTP expiration timestamp';
COMMENT ON COLUMN public.contract_signatories.otp_verified_at IS 'Timestamp when OTP was verified';