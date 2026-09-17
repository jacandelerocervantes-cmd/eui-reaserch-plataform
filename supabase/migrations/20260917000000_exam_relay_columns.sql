-- Agrega start_notified_at para rastrear el envío del aviso previo (10 min antes) por relay
alter table public.exams add column if not exists start_notified_at timestamptz;

