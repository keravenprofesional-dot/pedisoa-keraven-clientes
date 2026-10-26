-- TODA CLIENTA NACE AL CONTADO (pedido el 26-10-2026)
--
-- Al crearse, la clienta queda al contado y sin crédito, la cree quien la
-- cree (formulario, solicitud o cualquier otro camino). El crédito se lo da
-- después un gerente, editando la clienta.

create or replace function clienta_nace_al_contado()
returns trigger language plpgsql as $$
begin
  new.payment_condition := 'contado';
  new.credit_enabled    := false;
  new.credit_limit      := 0;
  return new;
end $$;

drop trigger if exists trg_clienta_nace_al_contado on clients;
create trigger trg_clienta_nace_al_contado
  before insert on clients
  for each row execute function clienta_nace_al_contado();
