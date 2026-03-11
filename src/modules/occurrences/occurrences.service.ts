import {
  getTypeIdByCode,
  insertOccurrence,
  insertDrivers,
  listOccurrencesByDay,
  getBaseCodeFromOccurrenceDriver,
  updateOccurrenceBaseCode,
  getDriverBaseById,
  updateOccurrenceData,
} from "./occurrences.repo.js";

/**
 * Cria uma nova ocorrência
 */
export async function createOccurrence(payload: any) {
  console.log("[DEBUG] Payload recebido antes do processamento:", payload);

  // Derivar typeId do código e validar os motoristas
  const typeId = await getTypeIdByCode(payload.typeCode);
  const drivers = validateDrivers(payload.drivers);

  const driver1 = drivers.find((d) => d.position === 1);
  if (!driver1) throw new Error("Motorista 01 é obrigatório.");

  const baseCode =
    payload.baseCode?.trim() || (await getDriverBaseById(driver1.driverId));
  if (!baseCode)
    throw new Error("Não foi possível derivar baseCode do Motorista 01.");

  // Construir os detalhes corretamente
  const details = buildDetails(payload);

  console.log("[DEBUG] Payload recebido após validação:", payload);
  console.log("[DEBUG] Details montado pelo BuildDetails:", details);

  const id = await insertOccurrence({
    type_id: typeId,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: payload.place,
    details, // <---- Certifique-se de que o campo `details` está sendo armazenado corretamente
  });

  // Inserir motoristas
  await insertDrivers(id, drivers);

  // Atualizar baseCode com snapshot caso necessário
  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  return id;
}

export async function getOccurrencesByDay(date: string) {
  return listOccurrencesByDay(date);
}

/**
 * Valida os motoristas recebidos no payload
 */
function validateDrivers(drivers: any[]) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    throw new Error("Drivers: informe pelo menos o Motorista 01.");
  }

  const d1 = drivers.find((d) => d?.position === 1);
  if (!d1?.driverId) throw new Error("Motorista 01 é obrigatório (driverId).");

  for (const d of drivers) {
    if (d.position !== 1 && d.position !== 2) {
      throw new Error("Drivers: position deve ser 1 ou 2.");
    }
    if (!d.driverId) {
      throw new Error(
        `Drivers: driverId é obrigatório (position ${d.position}).`,
      );
    }
  }

  const ids = drivers.map((d) => d.driverId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Drivers: não pode repetir o mesmo motorista.");
  }

  return drivers as Array<{ position: 1 | 2; driverId: string }>;
}

/**
 * Atualiza uma ocorrência existente
 */
export async function updateOccurrence(id: string, payload: any) {
  const typeId = await getTypeIdByCode(payload.typeCode);
  const drivers = validateDrivers(payload.drivers);

  const driver1 = drivers.find((d) => d.position === 1);
  if (!driver1) throw new Error("Motorista 01 é obrigatório.");

  const baseCode =
    payload.baseCode?.trim() || (await getDriverBaseById(driver1.driverId));
  if (!baseCode)
    throw new Error("Não foi possível derivar baseCode do Motorista 01.");

  const details = buildDetails(payload);

  console.log("[DEBUG] Atualizando ocorrência ID:", id);
  console.log("[DEBUG] Details montado:", details);

  await updateOccurrenceData(id, {
    type_id: typeId,
    event_date: payload.eventDate,
    trip_date: payload.tripDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    vehicle_number: payload.vehicleNumber,
    base_code: baseCode,
    line_label: payload.lineLabel ?? null,
    place: payload.place,
    details,
  });

  await insertDrivers(id, drivers);

  const snapshotBase = await getBaseCodeFromOccurrenceDriver(id);
  if (snapshotBase && snapshotBase !== baseCode) {
    await updateOccurrenceBaseCode(id, snapshotBase);
  }

  return id;
}

/**
 * Normaliza os campos details antes de gravar no banco
 */
function buildDetails(payload: any) {
  console.log(
    "[DEBUG] Recebido em buildDetails, payload.details:",
    payload.details,
  );

  // Inicializamos como um objeto vazio, que será populado dinamicamente
  const details: Record<string, any> = {};

  // Caso o campo `details` já exista, simplesmente retorne-o (assumindo que está no formato correto)
  if (payload.details && typeof payload.details === "object") {
    console.log("[DEBUG] Campo details recebido no payload:", payload.details);
    return payload.details;
  }

  // Construção manual dos detalhes com verificações em diferentes níveis do payload
  if (payload.velocidade != null) {
    details.velocidade = payload.velocidade; // Primeiro nível
  } else if (payload.details?.velocidade != null) {
    details.velocidade = payload.details.velocidade; // Campo dentro de details
  }

  if (payload.limite != null) {
    details.limite = payload.limite;
  } else if (payload.details?.limite != null) {
    details.limite = payload.details.limite;
  }

  if (payload.local != null) {
    details.local = payload.local;
  } else if (payload.details?.local != null) {
    details.local = payload.details.local;
  }

  console.log("[DEBUG] Details construído em buildDetails:", details);

  return details;
}
