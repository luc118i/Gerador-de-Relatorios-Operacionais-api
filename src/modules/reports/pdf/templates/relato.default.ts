import type { BuildRelatoArgs } from "./relato.types.js";
import { escapeHtml } from "../utils/pdf.utils.js";

export function buildRelatoDefault(args: BuildRelatoArgs) {
  const { vehicleNumber, tripDateLabel } = args.data;

  return `
Durante a análise das atividades do veículo de número <strong>${escapeHtml(vehicleNumber)}</strong> na viagem do dia <strong>${escapeHtml(tripDateLabel)}</strong>, foi identificado descumprimento das normas operacionais estabelecidas pela empresa.
`.replace(/\n/g, "<br/>");
}
