import { listOccurrencesByDay } from "../occurrences/occurrences.repo";
import type { DailyReportResult } from "./reports.types";

function toBRDate(iso: string) {
  // iso YYYY-MM-DD -> DD/MM/YYYY
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toHhMmToHhHmm(hhmm: string) {
  // "12:59" -> "12h59"
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

  // padrão: relatório do dia usa a data do documento = date
  const dateDocShort = toDocShort(date);

  const blocks = items.map((o: any) => {
    const drivers = (o.drivers ?? []).sort(
      (a: any, b: any) => a.position - b.position,
    );

    const lines: string[] = [];

    // 1 ou 2 motoristas
    if (drivers[0]) lines.push(driverLine(drivers[0], dateDocShort));
    if (drivers[1]) lines.push(driverLine(drivers[1], dateDocShort));

    lines.push(
      `OCORRÊNCIA: DESCUMPRIMENTO OPERACIONAL / PARADA FORA DO PROGRAMADO`,
    );
    lines.push(`DATA: ${toBRDate(o.eventDate)}`);
    lines.push(
      `Horario do evento: ${toHhMmToHhHmm(o.startTime)} à ${toHhMmToHhHmm(o.endTime)}.`,
    );
    lines.push(
      `Durante a análise das atividades do veículo de número ${o.vehicleNumber} na viagem do dia ${toBRDate(
        o.tripDate,
      )}, identificamos o descumprimento operacional/comercial por parte do condutor, realizando uma parada em local fora do esquema operacional.`,
    );
    lines.push(`-`);

    return lines.join("\n");
  });

  return { text: blocks.join("\n"), count: items.length };
}
