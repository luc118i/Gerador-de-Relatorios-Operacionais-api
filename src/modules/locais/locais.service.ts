import { findAllLocais, insertLocal } from "./locais.repo.js";

export async function listLocais(params: { search?: string }) {
  return findAllLocais(params.search);
}

export async function createLocal(payload: {
  nome: string;
  sigla?: string | null | undefined;
  tipo?: string | null | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
}) {
  return insertLocal(payload);
}
