import type { BuildRelatoArgs } from "./relato.types.js";
import { escapeHtml } from "../utils/pdf.utils.js";

export function buildRelatoVelocidade(args: BuildRelatoArgs) {
  const {
    vehicleNumber,
    tripDateLabel,
    eventDateLabel,
    horarioEvento,
    velocidade,
  } = args.data;

  return `
Em viagem realizada pelo veículo <strong>${escapeHtml(vehicleNumber)}</strong>, iniciada no dia <strong>${escapeHtml(tripDateLabel)}</strong>, identificamos que o motorista excedeu o limite de velocidade pré-estabelecido por diversas vezes.

No dia <strong>${escapeHtml(eventDateLabel ?? "—")}</strong>, às <strong>${escapeHtml(horarioEvento ?? "—")}</strong> chegou a atingir a velocidade de <strong>${escapeHtml(velocidade ?? "—")} km/h</strong>, colocando em perigo não somente a própria integridade física, mas também a dos demais passageiros e usuários da rodovia.

Essa conduta irresponsável representou um potencial risco de acidente ou colisão, configurando um flagrante de violação das normas de trânsito do CTB e um sério desrespeito à segurança viária.
`.replace(/\n/g, "<br/>");
}
