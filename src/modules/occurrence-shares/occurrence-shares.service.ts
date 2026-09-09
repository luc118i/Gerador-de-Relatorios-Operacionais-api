import { randomBytes } from "node:crypto";

import { AppError } from "../reports/pdf/pdf.errors.js";
import { getOccurrenceById, listHistory } from "../occurrences/occurrences.repo.js";
import { getSignedUrl } from "../evidences/evidences.repo.js";
import {
  deactivateSharesByOccurrence,
  getActiveShareByToken,
  getShareByOccurrence,
  insertShare,
  updateShare,
  type ShareRow,
} from "./occurrence-shares.repo.js";

const WORKFLOW_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_TRATAMENTO: "Em tratamento",
  AGUARDANDO_RETORNO: "Aguardando retorno",
  TRATADA: "Tratada",
  CANCELADA: "Cancelada",
  ARQUIVADA: "Arquivada",
};
const PRIORIDADE_LABEL: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};
const TRATATIVA_LABEL: Record<string, string> = {
  SUSPEICAO: "Suspensão",
  ADVERTENCIA: "Advertência",
  VALE: "Vale",
  REGISTRO: "Só o registro",
};

function newToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function getShare(occurrenceId: string): Promise<ShareRow | null> {
  return getShareByOccurrence(occurrenceId);
}

/** Revoga o link anterior e cria um novo token. */
export async function rotateShare(
  occurrenceId: string,
  createdBy: string | null,
  sections?: Record<string, boolean>,
): Promise<ShareRow> {
  await deactivateSharesByOccurrence(occurrenceId);
  return insertShare({
    token: newToken(),
    occurrenceId,
    createdBy,
    sections: sections ?? {},
  });
}

export async function patchShare(
  token: string,
  patch: { active?: boolean; sections?: Record<string, boolean> },
): Promise<ShareRow> {
  const row = await updateShare(token, patch);
  if (!row) throw new AppError(404, "Link não encontrado.", "SHARE_NOT_FOUND");
  return row;
}

const htmlHasText = (h?: string | null) =>
  !!(h ?? "").replace(/<[^>]+>/g, "").trim();

/** DTO redigido servido pelo link público. */
export async function getPublicOccurrence(token: string) {
  const share = await getActiveShareByToken(token);
  if (!share) {
    throw new AppError(404, "Link inválido ou revogado.", "SHARE_INACTIVE");
  }
  const on = (k: string) => share.sections?.[k] !== false;

  const o: any = await getOccurrenceById(share.occurrence_id);

  const isGenerico = o.typeCode === "GENERICO";
  const titulo = isGenerico
    ? o.reportTitle || o.typeTitle || "Ocorrência"
    : o.occurrenceName || o.typeTitle || "Ocorrência";
  const hora =
    o.startTime && o.startTime !== "00:00"
      ? o.endTime && o.endTime !== o.startTime
        ? `${o.startTime}–${o.endTime}`
        : o.startTime
      : "";
  const linha = o.lineLabel || o.tripLineName || "";
  const d1 = o.drivers?.find((d: any) => d.position === 1) ?? null;
  const d2 = o.drivers?.find((d: any) => d.position === 2) ?? null;
  const motoristas = [d1, d2]
    .filter(Boolean)
    .map((d: any) => ({ nome: d.name, matricula: d.registry || null }));

  const out: Record<string, unknown> = {
    code: String(o.id).slice(0, 8),
    titulo,
    tipo: o.typeTitle ?? null,
    status: {
      code: o.workflowStatus ?? "PENDENTE",
      label: WORKFLOW_LABEL[o.workflowStatus ?? "PENDENTE"] ?? o.workflowStatus,
    },
    prioridade: {
      code: o.prioridade ?? "MEDIA",
      label: PRIORIDADE_LABEL[o.prioridade ?? "MEDIA"] ?? o.prioridade,
    },
    eventDate: o.eventDate ?? null,
    hora,
    geradoEm: new Date().toISOString(),
    relatorioUrl: o.driveWebViewLink || null,
  };

  if (on("resumo")) {
    out.resumo = {
      local: o.place || linha || null,
      situacao: WORKFLOW_LABEL[o.workflowStatus ?? "PENDENTE"] ?? null,
      operadorCco: o.ccoOperator || null,
    };
  }
  if (on("viagem")) {
    out.viagem = {
      linha: linha || null,
      sentido: o.tripDirection || null,
      motoristas: motoristas.length ? motoristas : null,
    };
  }
  if (on("veiculo")) {
    out.veiculo = { prefixo: o.vehicleNumber ?? null, km: o.vehicleKm ?? null };
  }
  if (on("relato")) {
    out.relato = {
      relatoHtml: htmlHasText(o.relatoHtml) ? o.relatoHtml : null,
      devolutivaHtml: htmlHasText(o.devolutivaHtml) ? o.devolutivaHtml : null,
      devolutivaStatus: o.devolutivaStatus || null,
    };
  }
  if (on("tratativa")) {
    out.tratativa = {
      responsavel: o.analisadoPor || null,
      tipo: o.tratativa ? TRATATIVA_LABEL[o.tratativa] ?? o.tratativa : null,
      suspensao: o.suspensao
        ? { dias: o.suspensao.dias, dataInicio: o.suspensao.dataInicio }
        : null,
      encerrada: o.workflowStatus === "TRATADA",
    };
  }
  if (on("timeline")) {
    const hist = await listHistory(share.occurrence_id);
    out.timeline = hist.map((h) => ({
      at: h.createdAt,
      action: h.action,
      fromValue: h.fromValue,
      toValue: h.toValue,
      note: h.note,
    }));
  }
  if (on("evidencias")) {
    const evs: any[] = o.evidences ?? [];
    out.evidencias = await Promise.all(
      evs.map(async (e) => {
        const isPdf = String(e.storagePath ?? "").toLowerCase().endsWith(".pdf");
        if (e.linkUrl) {
          return { kind: "link", url: e.linkUrl, caption: e.linkTexto || e.caption || "" };
        }
        return {
          kind: isPdf ? "pdf" : "image",
          url: await getSignedUrl(e.storagePath),
          caption: e.caption || "",
        };
      }),
    );
  }

  return out;
}
