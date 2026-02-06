import type { ErrorRequestHandler } from "express";
import { AppError } from "../../modules/reports/pdf/pdf.errors"; // ajuste o path se necessário

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  console.error("[errorHandler]", {
    method: req.method,
    path: req.originalUrl,
    name: err?.name,
    message: err?.message,
    stack: err?.stack,
  });

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
  }

  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Erro inesperado" },
  });
};
