/**
 * Read-only slice of FHIR R4 (HL7) for the public HAPI test sandbox.
 *
 * All fetches happen server-side (the sandbox has no CORS headers, and this
 * demo never sends credentials or PHI). Mapping functions are pure so tests
 * can exercise them against fixture Bundles without any network access.
 */

export const FHIR_BASE_URL = "https://hapi.fhir.org/baseR4";

const FHIR_TIMEOUT_MS = 8_000;
// Kept in sync with `export const revalidate = 300` on the /fhir page.
const FHIR_REVALIDATE_SECONDS = 300;
const FHIR_PAGE_SIZE = 25;

export interface FhirPatient {
  id: string | null;
  name: string | null;
  gender: string | null;
  birthDate: string | null;
}

export interface FhirMedicationRequest {
  id: string | null;
  status: string | null;
  intent: string | null;
  medication: string | null;
  patientReference: string | null;
  authoredOn: string | null;
}

export type FhirResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Tolerant mapping (pure — safe to run on untrusted fixture data)
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function firstStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapPatientName(value: unknown): string | null {
  const names = Array.isArray(value) ? value : [];
  const first = asRecord(names[0]);
  if (!first) return null;

  const text = str(first.text);
  if (text) return text;

  const given = firstStringArray(first.given).join(" ");
  const family = str(first.family) ?? "";
  const full = [given, family].filter((part) => part.length > 0).join(" ");
  return full.length > 0 ? full : null;
}

export function mapPatient(resource: unknown): FhirPatient | null {
  const r = asRecord(resource);
  if (!r || r.resourceType !== "Patient") return null;

  return {
    id: str(r.id),
    name: mapPatientName(r.name),
    gender: str(r.gender),
    birthDate: str(r.birthDate),
  };
}

function mapMedicationDisplay(resource: Record<string, unknown>): string | null {
  const codeableConcept = asRecord(resource.medicationCodeableConcept);
  if (codeableConcept) {
    for (const coding of Array.isArray(codeableConcept.coding)
      ? codeableConcept.coding
      : []) {
      const display = str(asRecord(coding)?.display);
      if (display) return display;
    }
    return str(codeableConcept.text);
  }

  const reference = asRecord(resource.medicationReference);
  if (reference) {
    return str(reference.display) ?? str(reference.reference);
  }
  return null;
}

function mapSubjectReference(value: unknown): string | null {
  const subject = asRecord(value);
  if (!subject) return null;
  return str(subject.reference) ?? str(subject.display);
}

export function mapMedicationRequest(
  resource: unknown,
): FhirMedicationRequest | null {
  const r = asRecord(resource);
  if (!r || r.resourceType !== "MedicationRequest") return null;

  return {
    id: str(r.id),
    status: str(r.status),
    intent: str(r.intent),
    medication: mapMedicationDisplay(r),
    patientReference: mapSubjectReference(r.subject),
    authoredOn: str(r.authoredOn),
  };
}

/**
 * Walk a Bundle's entries with `mapResource`, skipping anything that does not
 * map. A malformed Bundle (or any non-Bundle value) yields an empty array —
 * never an exception.
 */
export function mapBundle<T>(
  bundle: unknown,
  mapResource: (resource: unknown) => T | null,
): T[] {
  const root = asRecord(bundle);
  const entries = root?.entry;
  if (!Array.isArray(entries)) return [];

  const mapped: T[] = [];
  for (const entry of entries) {
    const resource = asRecord(asRecord(entry)?.resource);
    if (!resource) continue;
    const item = mapResource(resource);
    if (item !== null) mapped.push(item);
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Server-side fetches (never throw — failures come back as typed results)
// ---------------------------------------------------------------------------

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return `The FHIR server did not respond within ${FHIR_TIMEOUT_MS / 1000} seconds.`;
    }
    return error.message;
  }
  return "Unknown error while contacting the FHIR server.";
}

async function fetchBundle(path: string): Promise<FhirResult<unknown>> {
  try {
    const response = await fetch(`${FHIR_BASE_URL}/${path}`, {
      headers: { Accept: "application/fhir+json" },
      signal: AbortSignal.timeout(FHIR_TIMEOUT_MS),
      next: { revalidate: FHIR_REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `The FHIR server responded with HTTP ${response.status} ${response.statusText}.`,
      };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function fetchPatients(): Promise<FhirResult<FhirPatient[]>> {
  const result = await fetchBundle(`Patient?_count=${FHIR_PAGE_SIZE}`);
  return result.ok
    ? { ok: true, data: mapBundle(result.data, mapPatient) }
    : result;
}

export async function fetchMedicationRequests(): Promise<
  FhirResult<FhirMedicationRequest[]>
> {
  const result = await fetchBundle(
    `MedicationRequest?_count=${FHIR_PAGE_SIZE}&_sort=-_lastUpdated`,
  );
  return result.ok
    ? { ok: true, data: mapBundle(result.data, mapMedicationRequest) }
    : result;
}
