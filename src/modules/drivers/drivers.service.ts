import {
  insertDriver,
  searchDrivers,
  updateDriverRepo,
  deleteDriverRepo,
} from "./drivers.repo.js";

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

export async function updateDriver(
  id: string,
  payload: {
    code?: string;
    name?: string;
    base?: string | null;
  },
) {
  const args: {
    id: string;
    code?: string;
    name?: string;
    base?: string | null;
  } = { id };

  if (payload.code !== undefined) {
    args.code = payload.code;
  }
  if (payload.name !== undefined) {
    args.name = payload.name;
  }
  if (payload.base !== undefined) {
    args.base = payload.base ?? null;
  }

  const updated = await updateDriverRepo(args);
  return updated;
}

export async function deleteDriver(id: string) {
  const deleted = await deleteDriverRepo(id);
  return deleted;
}
