// src/modules/drivers/drivers.service.ts
import { insertDriver, searchDrivers } from "./drivers.repo.js";

export async function listDrivers(args: {
  search?: string;
  active?: boolean;
  limit?: number;
}) {
  const rows = await searchDrivers(args);

  return rows.map((d: any) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    base: d.base,
    active: d.active,
  }));
}

type InsertDriverArgs = {
  code: string;
  name: string;
  base: string | null; // base SEMPRE presente
};

// drivers.service.ts
export async function createDriver(payload: {
  code: string;
  name: string;
  base?: string | null;
}) {
  const args: InsertDriverArgs = {
    code: payload.code,
    name: payload.name,
    base: payload.base ?? null, // nunca undefined
  };

  return insertDriver(args);
}
