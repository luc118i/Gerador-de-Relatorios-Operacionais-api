import { buildRelatoParada } from "./pdf/templates/relato.parada.js";
import { listOccurrencesByDay } from "../occurrences/occurrences.repo.js";
import type { DailyReportResult } from "./reports.types.js";

function toBRDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toHhMmToHhHmm(hhmm: string) {
  return hhmm.replace(":", "h");
}

function driverLine(d: any, dateDocShort: string) {
  return `${d.registry} – ${d.name} – ${d.base_code} – DESCUMP.OP - ${dateDocShort}`;
}

function toDocShort(iso: string) {
  const [y, m, d] = iso.split("-");
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid ISO date: ${iso}`);
  }
  return `${d}.${m}.${y.slice(2)}`;
}

export async function buildDailyReport(
  date: string,
): Promise<DailyReportResult> {
  const items = await listOccurrencesByDay(date);

  // Gera a data do documento
  const dateDocShort = toDocShort(date);

  const blocks = items.map((o: any) => {
    const drivers = (o.drivers ?? []).sort(
      (a: any, b: any) => a.position - b.position,
    );

    const lines: string[] = [];

    // Linhas de motoristas (1 ou 2)
    if (drivers[0]) lines.push(driverLine(drivers[0], dateDocShort));
    if (drivers[1]) lines.push(driverLine(drivers[1], dateDocShort));

    // Relato específico da Parada
    const relatoParada = buildRelatoParada({
      occurrenceType: "DESCUMP_OP_PARADA_FORA",
      data: {
        vehicleNumber: o.vehicleNumber ?? "—",
        tripDateLabel: toBRDate(o.tripDate ?? "Data não informada"),
        place: o.place,
      },
    });

    // Adicionar startTime e endTime ao trecho formatado com toHhMmToHhHmm
    lines.push(
      `Horário do evento: ${toHhMmToHhHmm(o.startTime ?? "00:00")}${o.endTime ? ` à ${toHhMmToHhHmm(o.endTime)}` : ""}.`,
    );
    lines.push(relatoParada);
    lines.push("-");

    return lines.join("\n");
  });

  return { text: blocks.join("\n"), count: items.length };
}
