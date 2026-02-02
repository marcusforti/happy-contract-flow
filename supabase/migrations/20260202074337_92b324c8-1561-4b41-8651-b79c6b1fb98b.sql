-- Enable realtime for contracts table
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;

-- Enable realtime for contract_signatories table (for progress bar updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_signatories;