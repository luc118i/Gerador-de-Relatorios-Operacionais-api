import { findAllLocais } from "./locais.repo.js";

export async function listLocais(params: { search?: string }) {
  return findAllLocais(params.search);
}
