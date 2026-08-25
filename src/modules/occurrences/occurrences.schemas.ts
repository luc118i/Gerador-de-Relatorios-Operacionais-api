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

  // derivados
  vehicleNumber: z.string().trim().min(1),

  baseCode: z.string().trim().min(1).optional(),

  // necessário para derivar vehicleNumber
  tripId: z.string().optional(), // se for uuid, troque pra z.string().uuid().optional()

  place: z.string().trim().optional().default(""),
  placeCode: z.string().nullable().optional(), // código numérico do local (ex: da aba LOCAIS do GAS)
  speedKmh: z.number().int().positive().optional().nullable(),
  tripTime: z.string().nullable().optional().transform((v) => v || null), // horário de partida da viagem (HH:mm)
  sessionTime: z.string().nullable().optional().transform((v) => v || null), // horário de sessão previsto no ponto (HH:mm), vindo do esquema operacional

  lineLabel: z.string().nullable().optional(), // opcional (se quiser)
  tripSentido: z.string().nullable().optional(), // IDA/VOLTA — sobrepõe o direction da viagem canônica, se enviado
  occurrenceName: z.string().optional().nullable(), // nome exato no RIZER

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
        driverId: z.string().trim().uuid().optional(),
        name:     z.string().trim().optional(),
        registry: z.string().trim().optional(),
        baseCode: z.string().trim().optional(),
      }),
    )
    .min(0)
    .max(2),

  tratativa: z.enum(["SUSPEICAO", "ADVERTENCIA", "VALE", "REGISTRO"]).optional().nullable(),
  analisadoPor: z.string().trim().optional().nullable(),
  // Vínculo best-effort com o usuário logado no app quando `analisadoPor` foi
  // definido por ele (não validado por JWT — ver migração
  // add_analisado_por_user_id_to_occurrences.sql). Ausente em ocorrências
  // importadas via GAS.
  analisadoPorUserId: z.string().uuid().optional().nullable(),

  // Campos gerados pela análise operacional (ANALISE_OP)
  paradasProibidas: z
    .array(z.object({ localNome: z.string(), localCodigo: z.string().nullable().optional() }))
    .optional(),
  paradaForaRelatoHtml: z.string().optional().nullable(),

  // Campos do tipo EXCESSO_PERMANENCIA — calculados no front-end
  // (_detectarExcedencias/_resolverRegiao em tempo_permanencia.html) e só
  // repassados à planilha via notifyAppsScriptExcesso, sem persistir no Supabase.
  cidade: z.string().optional(),
  uf: z.string().optional(),
  regiao: z.string().optional(),
  permanenciaMin: z.number().optional(),
  permitidoMin: z.number().optional(),
  excedenteMin: z.number().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  // "ENVIADA" | "PULADA" | ausente — se o motorista foi questionado via
  // WhatsApp (botão "Perguntar ao motorista", ponto de apoio) antes deste
  // relatório ser gerado. Rodoviária nunca manda isso (fluxo não existe
  // lá). Ver excesso-parada.template.ts pra como aparece no PDF.
  motoristaQuestionado: z.string().optional().nullable(),

  // Vários pontos de parada dentro de UMA ocorrência EXCESSO_PERMANENCIA
  // (ex.: motorista excede em mais de um ponto na mesma viagem) — evita
  // criar N ocorrências/N envios ao RIZER pro mesmo motorista/dia. Quando
  // ausente, o backend monta um array de 1 ponto a partir dos campos acima
  // (comportamento de sempre, inclusive pro fluxo individual).
  points: z
    .array(
      z.object({
        place: z.string().trim().min(1),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime deve ser HH:mm"),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime deve ser HH:mm"),
        cidade: z.string().optional(),
        uf: z.string().optional(),
        regiao: z.string().optional(),
        permanenciaMin: z.number().optional(),
        permitidoMin: z.number().optional(),
        excedenteMin: z.number().optional(),
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional(),
        motoristaQuestionado: z.string().optional().nullable(),
      }),
    )
    .min(1)
    .optional(),
}).superRefine((data, ctx) => {
  const tripulacaoAtiva = data.showSectionTripulacao !== false;
  if (!tripulacaoAtiva) return; // seção desabilitada — sem validação de motoristas

  // Aceita driver com driverId (UUID) OU com name inline
  const has1 = data.drivers.some((d) => d.position === 1 && (d.driverId || d.name));
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

  const ids = data.drivers.filter((d) => d.driverId).map((d) => d.driverId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["drivers"],
      message: "Não é permitido repetir o mesmo motorista.",
    });
  }
});
