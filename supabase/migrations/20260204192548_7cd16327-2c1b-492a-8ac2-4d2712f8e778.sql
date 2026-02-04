-- Add CPF column to contract_signatories table
ALTER TABLE public.contract_signatories 
ADD COLUMN cpf text;