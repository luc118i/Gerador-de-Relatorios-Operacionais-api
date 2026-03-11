import type { BuildRelatoArgs } from "./relato.types.js";
import { escapeHtml } from "../utils/pdf.utils.js";

export function buildRelatoParada(args: BuildRelatoArgs): string {
  // Extraindo os dados necessários do objeto args
  const { vehicleNumber, tripDateLabel, place } = args.data;

  // Construindo o texto do relatório, ajustando espaços e formatação
  return `
Durante a análise das atividades do veículo de número <strong>${escapeHtml(vehicleNumber)}</strong>
na viagem do dia <strong>${escapeHtml(tripDateLabel)}</strong>${place ? `, em <strong>${escapeHtml(place)}</strong>` : ""},
identificamos o descumprimento operacional/comercial por parte do condutor,
realizando uma parada em local fora do esquema operacional pré-estabelecido.
Esta atitude representou uma clara violação das normas e padrões pré-estabelecidos,
gerando atraso na viagem, prejudicando a qualidade do serviço e desconformidades das
informações divulgadas no ato da venda dos bilhetes de passagens.
`
    .replace(/\s+/g, " ")
    .trim();
}
