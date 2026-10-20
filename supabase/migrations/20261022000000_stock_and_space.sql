-- Free text for the report's "Stock and Space Utilisation" section.
-- One line per point; each line becomes a bullet in the report.
alter table public.visits add column stock_and_space text;
