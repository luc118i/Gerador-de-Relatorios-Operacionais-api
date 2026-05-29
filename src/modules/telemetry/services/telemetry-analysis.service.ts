import { haversineKm } from "../../../shared/geo/index.js";
import { diffSeconds, toMinutes, formatDuration, extractDate } from "../../../shared/time/index.js";
import { SPEED_THRESHOLDS } from "../constants/speed-thresholds.js";
import { getStopLimit } from "../constants/stop-thresholds.js";
import type {
  TelemetryPoint,
  TelemetrySegment,
  TelemetryAlert,
  TelemetryAnalysisResult,
  AlertLevel,
} from "../types/telemetry.types.js";

export function analyze(enrichedTrip: TelemetryPoint[]): TelemetryAnalysisResult {
  if (enrichedTrip.length === 0) {
    return { points: [], segments: [], alerts: [], summary: emptySummary() };
  }

  const segments: TelemetrySegment[] = [];
  const alerts: TelemetryAlert[] = [];

  // ─── Segmentos entre pontos consecutivos ─────────────────────────────────
  for (let i = 0; i < enrichedTrip.length - 1; i++) {
    const A = enrichedTrip[i]!;
    const B = enrichedTrip[i + 1]!;

    let distKm: number | null = null;
    let tempoMin: number | null = null;
    let velocidadeKmh: number | null = null;
    const segAlertas: TelemetryAlert[] = [];

    if (A.lat && A.lng && B.lat && B.lng) {
      distKm = haversineKm(A.lat, A.lng, B.lat, B.lng);
    }

    if (A.saida && B.entrada) {
      const diffS = diffSeconds(A.saida, B.entrada);
      if (diffS !== null && diffS > 0) {
        tempoMin = toMinutes(diffS);
      }
    }

    if (distKm !== null && tempoMin !== null && tempoMin > 0) {
      velocidadeKmh = Math.round((distKm / (tempoMin / 60)) * 10) / 10;
    }

    // Alertas de velocidade — só avalia segmentos com dados confiáveis
    const tempoS = tempoMin !== null ? Math.round(tempoMin * 60) : 0;
    const segValid =
      velocidadeKmh !== null &&
      distKm !== null &&
      distKm >= SPEED_THRESHOLDS.DIST_MIN_ALERTA_KM &&
      tempoS >= SPEED_THRESHOLDS.TEMPO_MIN_ALERTA_S;

    if (segValid && velocidadeKmh !== null && distKm !== null && tempoMin !== null) {
      const distLabel  = distKm.toFixed(1) + " km";
      const tempoLabel = Math.round(tempoMin) + " min";
      const velLabel   = velocidadeKmh + " km/h";
      const trechoBase = `"${A.ponto}" → "${B.ponto}" (${distLabel} em ${tempoLabel}, vel. média ${velLabel})`;

      if (velocidadeKmh > SPEED_THRESHOLDS.CRITICO_MIN_KMH) {
        const alerta: TelemetryAlert = {
          tipo: "VELOCIDADE_EXCESSIVA",
          nivel: "critical",
          descricao: `Excesso crítico de velocidade no trecho ${trechoBase}. Faixa ideal: ${SPEED_THRESHOLDS.IDEAL_MIN_KMH}–${SPEED_THRESHOLDS.IDEAL_MAX_KMH} km/h.`,
          seq: i + 1,
          trecho: `${A.ponto} → ${B.ponto}`,
          distKm,
          tempoMin: Math.round(tempoMin),
          velocidadeKmh,
        };
        segAlertas.push(alerta);
        alerts.push(alerta);
      } else if (velocidadeKmh > SPEED_THRESHOLDS.ALTO_MIN_KMH) {
        const alerta: TelemetryAlert = {
          tipo: "VELOCIDADE_ALTA",
          nivel: "attention",
          descricao: `Excesso de velocidade no trecho ${trechoBase}. Faixa ideal: ${SPEED_THRESHOLDS.IDEAL_MIN_KMH}–${SPEED_THRESHOLDS.IDEAL_MAX_KMH} km/h.`,
          seq: i + 1,
          trecho: `${A.ponto} → ${B.ponto}`,
          distKm,
          tempoMin: Math.round(tempoMin),
          velocidadeKmh,
        };
        segAlertas.push(alerta);
        alerts.push(alerta);
      } else if (velocidadeKmh < SPEED_THRESHOLDS.BAIXA_MAX_KMH) {
        const alerta: TelemetryAlert = {
          tipo: "VELOCIDADE_BAIXA",
          nivel: "attention",
          descricao: `Velocidade abaixo do ideal no trecho ${trechoBase}. Faixa ideal: ${SPEED_THRESHOLDS.IDEAL_MIN_KMH}–${SPEED_THRESHOLDS.IDEAL_MAX_KMH} km/h.`,
          seq: i + 1,
          trecho: `${A.ponto} → ${B.ponto}`,
          distKm,
          tempoMin: Math.round(tempoMin),
          velocidadeKmh,
        };
        segAlertas.push(alerta);
        alerts.push(alerta);
      }
      // Faixa ideal → sem alerta
    }

    segments.push({
      seq: i + 1,
      de: A.ponto,
      para: B.ponto,
      deSeq: A.seq,
      paraSeq: B.seq,
      distKm,
      tempoMin,
      velocidadeKmh,
      alertas: segAlertas,
    });
  }

  // ─── Alertas por ponto ────────────────────────────────────────────────────
  for (const pt of enrichedTrip) {
    if (!pt.matched) {
      alerts.push({
        tipo: "LOCAL_NAO_IDENTIFICADO",
        nivel: "info",
        descricao: `Ponto "${pt.ponto}" não encontrado na base de locais`,
        seq: pt.seq,
        trecho: pt.ponto,
      });
    }

    if (pt.matched && isTipo42(pt.tipo) && pt.parada_s > 0) {
      pt.proibido42 = true;
      alerts.push({
        tipo: "PARADA_PROIBIDA",
        nivel: "critical",
        descricao: `Parada de ${formatDuration(pt.parada_s)} em local proibido: "${pt.ponto}"`,
        seq: pt.seq,
        trecho: pt.ponto,
      });
    }

    if (pt.parada_s > 0) {
      const paradaMin = toMinutes(pt.parada_s);
      const limite = getStopLimit({ rodoviaria: pt.rodoviaria, garagem: pt.garagem });

      if (paradaMin > limite.esperadoMin + limite.toleranciaMin) {
        const nivel: AlertLevel = paradaMin > limite.esperadoMin * 2 ? "critical" : "attention";
        alerts.push({
          tipo: "PARADA_LONGA",
          nivel,
          descricao: `Parada de ${formatDuration(pt.parada_s)} em "${pt.ponto}" (limite: ${limite.esperadoMin}min)`,
          seq: pt.seq,
          trecho: pt.ponto,
        });
      }
    }
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  const totalKm     = segments.reduce((acc, s) => acc + (s.distKm ?? 0), 0);
  const tempoTotal  = segments.reduce((acc, s) => acc + (s.tempoMin ?? 0), 0);
  const veloMedia   = tempoTotal > 0 ? Math.round((totalKm / (tempoTotal / 60)) * 10) / 10 : 0;

  const ptMaiorParada = enrichedTrip.reduce<TelemetryPoint | null>(
    (best, pt) => ((pt.parada_s ?? 0) > (best?.parada_s ?? 0) ? pt : best),
    null,
  );
  const maiorParada =
    ptMaiorParada && ptMaiorParada.parada_s > 0
      ? { ponto: ptMaiorParada.ponto, duracaoStr: formatDuration(ptMaiorParada.parada_s) }
      : null;

  const primeiro = enrichedTrip.find((p) => p.funcionario && p.funcionario !== "Não Informado");
  const motorista = primeiro?.funcionario ?? enrichedTrip[0]?.funcionario ?? "Não Informado";

  const first = enrichedTrip[0]!;
  const last  = enrichedTrip[enrichedTrip.length - 1]!;

  const summary = {
    veiculo:         first.veiculo ?? "—",
    motorista:       motorista ?? "Não Informado",
    dataViagem:      first.entrada ? extractDate(first.entrada) : "—",
    dataFim:         last.saida   ? extractDate(last.saida)    : "—",
    totalPontos:     enrichedTrip.length,
    totalKm:         Math.round(totalKm * 100) / 100,
    tempoTotalMin:   Math.round(tempoTotal),
    velocidadeMedia: veloMedia,
    maiorParada,
    totalAlertas:    alerts.length,
    alertasCriticos: alerts.filter((a) => a.nivel === "critical").length,
    pontosNaoId:     enrichedTrip.filter((p) => !p.matched).length,
  };

  return { points: enrichedTrip, segments, alerts, summary };
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function isTipo42(tipo: string | null): boolean {
  const s = String(tipo ?? "").trim();
  if (/\b42\b/.test(s)) return true;
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .includes("nao autorizado");
}

function emptySummary() {
  return {
    veiculo: "—", motorista: "Não Informado",
    dataViagem: "—", dataFim: "—",
    totalPontos: 0, totalKm: 0, tempoTotalMin: 0,
    velocidadeMedia: 0, maiorParada: null,
    totalAlertas: 0, alertasCriticos: 0, pontosNaoId: 0,
  };
}
