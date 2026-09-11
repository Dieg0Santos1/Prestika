import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';
import type { ClientFormValues } from './schema';

export type Client = Tables<'clientes'>;

function getClient() {
  if (!supabase) throw new Error('Supabase no está configurado.');
  return supabase;
}

export async function listClients() {
  const { data, error } = await getClient()
    .from('clientes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getClientById(id: string) {
  const { data, error } = await getClient().from('clientes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createClient(values: ClientFormValues) {
  const input: TablesInsert<'clientes'> = {
    nombres: values.nombres.trim(),
    apellidos: values.apellidos.trim() || null,
    celular: values.celular.trim() || null,
    metodo_pago_preferido: values.metodoPago || null,
    numero_yape_plin: values.numeroYapePlin.trim() || null,
    observaciones: values.observaciones.trim() || null,
  };
  const { data, error } = await getClient().from('clientes').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, values: ClientFormValues) {
  const input: TablesUpdate<'clientes'> = {
    nombres: values.nombres.trim(),
    apellidos: values.apellidos.trim() || null,
    celular: values.celular.trim() || null,
    metodo_pago_preferido: values.metodoPago || null,
    numero_yape_plin: values.numeroYapePlin.trim() || null,
    observaciones: values.observaciones.trim() || null,
  };
  const { data, error } = await getClient().from('clientes').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function setClientStatus(id: string, estado: 'ACTIVO' | 'INACTIVO') {
  const { data, error } = await getClient().from('clientes').update({ estado }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
