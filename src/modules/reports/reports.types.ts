export type DailyReportItem = {
  vehicleNumber: string;
  tripDate: string; // YYYY-MM-DD
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  baseCode: string;
  drivers: Array<{
    position: 1 | 2;
    registry: string;
    name: string;
    base_code: string;
  }>;
};

export type DailyReportResult = { text: string; count: number };
