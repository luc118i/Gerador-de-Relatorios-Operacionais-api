import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../../modules/reports/pdf/pdf.errors.js";

function getSupabaseCode(err: any): string | undefined {
  // supabase-js costuma expor `code`
  return err?.code ?? err?.cause?.code;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  console.error("[errorHandler]", {
    method: req.method,
    path: req.originalUrl,
    name: err?.name,
    code: getSupabaseCode(err),
    message: err?.message,
    stack: err?.stack,
  });

  // 1) Erros de validação
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Payload inválido",
        issues: err.issues,
      },
    });
  }

  // 2) Erros “conhecidos” da app
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  // 3) Erros do Postgres via Supabase
  const pg = getSupabaseCode(err);

  // unique_violation (ex.: motorista duplicado na ocorrência)
  if (pg === "23505") {
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Conflito de dados (registro duplicado).",
      },
    });
  }

  // foreign_key_violation (driver_id inexistente, occurrence_id inexistente)
  if (pg === "23503") {
    return res.status(400).json({
      error: {
        code: "FK_VIOLATION",
        message: "Referência inválida (registro relacionado não existe).",
      },
    });
  }

  // PostgREST: .single() não encontrou registro (muito comum no getTypeIdByCode)
  if (pg === "PGRST116") {
    return res.status(400).json({
      error: {
        code: "NOT_FOUND",
        message: "Registro não encontrado para os parâmetros informados.",
      },
    });
  }

  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro inesperado" },
  });
};
