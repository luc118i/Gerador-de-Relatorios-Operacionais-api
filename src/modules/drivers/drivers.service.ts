import {
  insertDriver,
  lookupDriverByCode,
  searchDrivers,
  updateDriverRepo,
  deleteDriverRepo,
  upsertDriverRepo,
  getDriverTratativaCounts,
} from "./drivers.repo.js";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export async function lookupDriver(code: string) {
  const row = await lookupDriverByCode(code);
  if (!row) return null;
  return { id: row.id, code: row.code, name: row.name, base: row.base };
}

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
    base: payload.base ?? null,
  };

  const row = await insertDriver(args);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    base: row.base,
  };
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

export async function getDriverStats(driverId: string) {
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0, 0, 0, 0,
  ).toISOString();

  const counts = await getDriverTratativaCounts(driverId, monthStart);

  return {
    driverId,
    advertencia: counts.advertencia,
    vale: counts.vale,
    suspensao: counts.suspensao,
    total: counts.total,
    periodLabel: `${MESES[now.getMonth()]}/${now.getFullYear()}`,
  };
}

export async function upsertDriver(payload: {
  code: string;
  name: string;
  base?: string | null;
}) {
  const row = await upsertDriverRepo({
    code: payload.code,
    name: payload.name,
    base: payload.base ?? null,
  });
  return { id: row.id, code: row.code, name: row.name, base: row.base };
}
