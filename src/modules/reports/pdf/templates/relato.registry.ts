import type { BuildRelatoArgs, RelatoBuilder } from "./relato.types.js";

import { buildRelatoParada } from "./relato.parada.js";
import { buildRelatoVelocidade } from "./relato.velocidade.js";
import { buildRelatoDefault } from "./relato.default.js";

import { escapeHtml } from "../utils/pdf.utils.js";

const RELATO_BUILDERS: Record<string, RelatoBuilder> = {
  PARADA_IRREGULAR: buildRelatoParada,
  VELOCIDADE: buildRelatoVelocidade,
};

export function buildRelato(args: BuildRelatoArgs) {
  const userText = (args.reportText ?? "").trim();

  if (userText) {
    return escapeHtml(userText).replace(/\n/g, "<br/>");
  }

  const builder = RELATO_BUILDERS[args.occurrenceType];

  return builder ? builder(args) : buildRelatoDefault(args);
}
