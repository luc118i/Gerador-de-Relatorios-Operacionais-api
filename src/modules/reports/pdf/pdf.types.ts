export type PdfEvidence = {
  id: string;
  storagePath: string;
  mimeType: string | null;
  caption?: string | null;
  sortOrder?: number | null;
  linkTexto?: string | null;
  linkUrl?: string | null;
};

export type PdfOccurrence = {
  id: string;
  typeId: string;

  typeTitle?: string | null;
  typeCode?: string | null;

  eventDate?: string | null;
  tripDate: string;
  startTime: string;
  endTime: string;

  vehicleNumber: string;
  baseCode: string;
  lineLabel?: string | null;
  place?: string | null;

  reportText?: string | null;

  dailyTemplate?: string | null;

  extra?: OccurrenceExtra | null;
};

export type OccurrenceExtra = {
  velocidade?: string;
  limite?: string;
  local?: string;
};

export type PdfDriver = {
  id: string;
  name: string;
  code?: string | null;
  baseCode?: string | null;
};

export type BuildPdfResult = {
  pdfStoragePath: string;
  signedUrl: string;
  ttlSeconds: number;
  cached: boolean;
};
