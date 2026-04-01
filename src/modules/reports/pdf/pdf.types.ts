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

  eventDate: string;
  tripDate: string;
  startTime: string;
  endTime: string;

  vehicleNumber: string;
  baseCode: string;
  lineLabel?: string | null;
  place: string;
  speedKmh?: number | null;

  reportText: string;

  // Campos do tipo GENERICO (CCO)
  reportTitle?: string | null;
  ccoOperator?: string | null;
  vehicleKm?: number | null;
  passengerCount?: number | null;
  passengerConnection?: string | null;
  relatoHtml?: string | null;
  devolutivaHtml?: string | null;
  devolutivaStatus?: string | null;
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
