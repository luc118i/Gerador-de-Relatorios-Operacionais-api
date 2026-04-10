// src/modules/occurrences/occurrences.schemas.ts
import { z } from "zod";

export const createOccurrenceSchema = z.object({
  typeCode: z.string(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "eventDate deve ser YYYY-MM-DD"),
  tripDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "tripDate deve ser YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime deve ser HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime deve ser HH:mm"),

  // ✅ derivados
  vehicleNumber: z.string().trim().min(1),

  baseCode: z.string().trim().min(1).optional(),

  // ✅ necessário para derivar vehicleNumber
  tripId: z.string().optional(), // se for uuid, troque pra z.string().uuid().optional()

  place: z.string().trim().optional().default(""),
  speedKmh: z.number().int().positive().optional().nullable(),
  tripTime: z.string().nullable().optional(), // horário de partida da viagem (HH:mm)

  lineLabel: z.string().nullable().optional(), // opcional (se quiser)

  // Campos do tipo GENERICO (CCO)
  reportTitle: z.string().optional().nullable(),
  ccoOperator: z.string().optional().nullable(),
  vehicleKm: z.number().int().nonnegative().optional().nullable(),
  passengerCount: z.number().int().nonnegative().optional().nullable(),
  passengerConnection: z.string().optional().nullable(),
  relatoHtml: z.string().optional().nullable(),
  devolutivaHtml: z.string().optional().nullable(),
  devolutivaStatus: z.string().optional().nullable(),
  showSectionViagem: z.boolean().optional().default(true),
  showSectionIdentificacao: z.boolean().optional().default(true),
  showSectionDados: z.boolean().optional().default(true),
  showSectionTripulacao: z.boolean().optional().default(true),
  showSectionPassageiros: z.boolean().optional().default(true),
  devolutivaBeforeEvidences: z.boolean().optional().default(false),

  drivers: z
    .array(
      z.object({
        position: z.union([z.literal(1), z.literal(2)]),
        driverId: z.string().trim().uuid(),
      }),
    )
    .min(0)
    .max(2),
}).superRefine((data, ctx) => {
  const tripulacaoAtiva = data.showSectionTripulacao !== false;
  if (!tripulacaoAtiva) return; // seção desabilitada — sem validação de motoristas

  const has1 = data.drivers.some((d) => d.position === 1);
  if (!has1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["drivers"],
      message: "Motorista 01 (position=1) é obrigatório.",
    });
  }

  if (data.drivers.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["drivers"],
      message: "Informe pelo menos o Motorista 01.",
    });
  }

  const ids = data.drivers.map((d) => d.driverId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["drivers"],
      message: "Não é permitido repetir o mesmo motorista.",
    });
  }
});
