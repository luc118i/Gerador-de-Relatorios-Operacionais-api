// src/modules/trips/trips.repo.ts
import { supabaseAdmin } from "../../core/infra/supabaseAdmin.js";

export async function searchTrips(args: {
  search?: string;
  active?: boolean;
  limit?: number;
}) {
  const search = (args.search ?? "").trim();
  const active = args.active ?? true;
  const limit = args.limit ?? 300;

  let q = supabaseAdmin
    .from("trips")
    .select("id, line_code, line_name, departure_time, direction, active, created_at")
    .eq("active", active)
    .order("line_code", { ascending: true })
    .limit(limit);

  if (search) {
    q = q.or(`line_code.ilike.%${search}%,line_name.ilike.%${search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function insertTrip(args: {
  lineCode: string;
  lineName: string;
  departureTime: string;
  direction: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("trips")
    .insert({
      line_code: args.lineCode.trim(),
      line_name: args.lineName.trim(),
      departure_time: args.departureTime.trim(),
      direction: args.direction.trim(),
      active: true,
    })
    .select("id, line_code, line_name, departure_time, direction")
    .single();

  if (error) throw error;
  return data as { id: string; line_code: string; line_name: string; departure_time: string; direction: string };
}
