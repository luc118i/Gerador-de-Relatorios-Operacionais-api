import {
  insertDriver,
  lookupDriverByCode,
  getDriverById,
  searchDrivers,
  updateDriverRepo,
  deleteDriverRepo,
  upsertDriverRepo,
  getDriverTratativaCounts,
  findDriversByCodes,
  getAllDriversForMatch,
  type MatchDriverRow,
} from "./drivers.repo.js";
import { normalizeText } from "../../shared/normalizer/index.js";
import type { MatchDriverItem } from "./drivers.schemas.js";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export async function lookupDriver(code: string) {
  const row = await lookupDriverByCode(code);
  if (!row) return null;
  return { id: row.id, code: row.code, name: row.name, base: row.base, phone: row.phone };
}

export async function getDriver(id: string) {
  const row = await getDriverById(id);
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    base: row.base,
    phone: row.phone,
    criadoPor: row.criado_por ?? null,
    criadoPorId: row.criado_por_user_id ?? null,
    criadoEm: row.created_at ?? null,
  };
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
    phone: d.phone,
    active: d.active,
  }));
}

type InsertDriverArgs = {
  code: string;
  name: string;
  base: string | null; // base SEMPRE presente
  phone?: string | null;
  criadoPor?: string | null;
  criadoPorId?: string | null;
};

export async function createDriver(payload: {
  code: string;
  name: string;
  base?: string | null;
  phone?: string | null;
  criadoPor?: string | null;
  criadoPorId?: string | null;
}) {
  const args: InsertDriverArgs = {
    code: payload.code,
    name: payload.name,
    base: payload.base ?? null,
    phone: payload.phone ?? null,
    criadoPor: payload.criadoPor ?? null,
    criadoPorId: payload.criadoPorId ?? null,
  };

  const row = await insertDriver(args);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    base: row.base,
    phone: row.phone,
    criadoPor: row.criado_por ?? null,
    criadoPorId: row.criado_por_user_id ?? null,
    criadoEm: row.created_at ?? null,
  };
}

export async function updateDriver(
  id: string,
  payload: {
    code?: string;
    name?: string;
    base?: string | null;
    phone?: string | null;
  },
) {
  const args: {
    id: string;
    code?: string;
    name?: string;
    base?: string | null;
    phone?: string | null;
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
  if (payload.phone !== undefined) {
    args.phone = payload.phone ?? null;
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

const normCode = (c: string) => c.trim().toUpperCase();

function shapeMatch(r: MatchDriverRow) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    base: r.base,
    phone: r.phone,
    active: r.active,
  };
}

// Match em lote de motoristas (matrícula e/ou nome) -> registro do banco
// com telefone. Estratégia por item: (1) matrícula exata; (2) matrícula
// ignorando zeros à esquerda, só se resolver pra um único motorista;
// (3) nome normalizado (sem acento/caixa), só se único. Empates viram
// `ambiguous` e não escolhem ninguém.
export async function matchDrivers(
  items: MatchDriverItem[],
  includeInactive: boolean,
) {
  // Envia a matrícula normalizada E a variante sem zeros à esquerda, pra
  // casar nos dois sentidos (planilha guarda "00030", banco pode ter "30"
  // ou vice-versa — o /drivers/upsert só faz trim).
  const codes = Array.from(
    new Set(
      items
        .flatMap((i) => {
          if (!i.code) return [];
          const c = normCode(i.code);
          const loose = c.replace(/^0+/, "");
          return loose && loose !== c ? [c, loose] : [c];
        })
        .filter(Boolean),
    ),
  );

  const byCodeRows = await findDriversByCodes(codes, includeInactive);

  const codeMap = new Map<string, MatchDriverRow[]>();
  const looseCodeMap = new Map<string, MatchDriverRow[]>();
  for (const r of byCodeRows) {
    const k = normCode(r.code);
    (codeMap.get(k) ?? codeMap.set(k, []).get(k)!).push(r);

    const loose = k.replace(/^0+/, "");
    if (loose) {
      (looseCodeMap.get(loose) ?? looseCodeMap.set(loose, []).get(loose)!).push(r);
    }
  }

  const codeResolves = (code?: string) => {
    if (!code) return false;
    const c = normCode(code);
    if ((codeMap.get(c)?.length ?? 0) === 1) return true;
    const loose = c.replace(/^0+/, "");
    return loose !== c && (looseCodeMap.get(loose)?.length ?? 0) === 1;
  };

  // Só carrega a tabela inteira se sobrar `name` sem match por matrícula.
  const needsNameIndex = items.some((i) => i.name && !codeResolves(i.code));

  let nameMap: Map<string, MatchDriverRow[]> | null = null;
  if (needsNameIndex) {
    const all = await getAllDriversForMatch(includeInactive);
    nameMap = new Map();
    for (const r of all) {
      const k = normalizeText(r.name);
      (nameMap.get(k) ?? nameMap.set(k, []).get(k)!).push(r);
    }
  }

  let matched = 0;
  let byCode = 0;
  let byName = 0;
  let ambiguous = 0;

  const results = items.map((input, index) => {
    if (input.code) {
      const exact = codeMap.get(normCode(input.code));
      if (exact && exact.length === 1) {
        matched++;
        byCode++;
        return { index, input, matched: true, matchedBy: "code", driver: shapeMatch(exact[0]!) };
      }
      if (exact && exact.length > 1) {
        ambiguous++;
        return { index, input, matched: false, ambiguous: true, reason: "várias matrículas iguais" };
      }

      const loose = looseCodeMap.get(normCode(input.code).replace(/^0+/, ""));
      if (loose && loose.length === 1) {
        matched++;
        byCode++;
        return { index, input, matched: true, matchedBy: "code-loose", driver: shapeMatch(loose[0]!) };
      }
    }

    if (input.name && nameMap) {
      const hit = nameMap.get(normalizeText(input.name));
      if (hit && hit.length === 1) {
        matched++;
        byName++;
        return { index, input, matched: true, matchedBy: "name", driver: shapeMatch(hit[0]!) };
      }
      if (hit && hit.length > 1) {
        ambiguous++;
        return { index, input, matched: false, ambiguous: true, reason: "vários motoristas com o mesmo nome" };
      }
    }

    return { index, input, matched: false };
  });

  return {
    results,
    summary: {
      total: items.length,
      matched,
      unmatched: items.length - matched,
      byCode,
      byName,
      ambiguous,
    },
  };
}

export async function upsertDriver(payload: {
  code: string;
  name: string;
  base?: string | null;
  phone?: string | null;
}) {
  const row = await upsertDriverRepo({
    code: payload.code,
    name: payload.name,
    base: payload.base ?? null,
    phone: payload.phone ?? null,
  });
  return { id: row.id, code: row.code, name: row.name, base: row.base, phone: row.phone };
}
