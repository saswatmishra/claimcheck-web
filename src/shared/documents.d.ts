export const MAX_FILE_BYTES: number;
export const DOCUMENT_MIME_TYPES: string[];
export function validateDocumentFile(file: { type?: string; mimetype?: string; size: number }): string | null;
export function validDateISO(value: unknown): string | null;
export function calendarDaysBetween(start: string, end: string): number | null;
export function normalizeVehicleNumber(value: unknown): string | null;
export function normalizePersonName(value: string | null | undefined): string;
