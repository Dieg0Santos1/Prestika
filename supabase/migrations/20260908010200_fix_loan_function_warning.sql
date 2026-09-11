-- El contador de un FOR entero es declarado implícitamente por PL/pgSQL.
-- Retiramos la declaración redundante sin alterar el contrato de la función.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.crear_prestamo(uuid,numeric,numeric,integer,text,text,uuid)'::regprocedure
  ) into v_definition;

  v_definition := replace(v_definition, E'  v_numero integer;\n', '');
  execute v_definition;
end;
$$;
