import { describe, expect, it } from "vitest";

import { mapBundle, mapMedicationRequest, mapPatient } from "@/lib/fhir";

const patientBundle = {
  resourceType: "Bundle",
  type: "searchset",
  total: 2,
  entry: [
    {
      fullUrl: "https://hapi.fhir.org/baseR4/Patient/wellnessapp-demo-alex-223",
      resource: {
        resourceType: "Patient",
        id: "wellnessapp-demo-alex-223",
        name: [{ use: "official", family: "Morgan", given: ["Alex"] }],
        gender: "female",
        birthDate: "1980-01-15",
      },
    },
    {
      resource: {
        resourceType: "Patient",
        id: "named-via-text",
        name: [{ text: "Chris Smith" }],
        gender: "male",
      },
    },
  ],
};

const medicationRequestBundle = {
  resourceType: "Bundle",
  type: "searchset",
  entry: [
    {
      resource: {
        resourceType: "MedicationRequest",
        id: "50532",
        status: "active",
        intent: "order",
        medicationCodeableConcept: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "322236009",
              display: "Paracetamol 500 mg oral tablet",
            },
          ],
          text: "普拿疼退燒藥 500mg",
        },
        subject: { reference: "Patient/50522" },
        authoredOn: "2026-09-20T12:00:00+00:00",
      },
    },
    {
      resource: {
        resourceType: "MedicationRequest",
        id: "50533",
        status: "draft",
        intent: "proposal",
        medicationReference: {
          reference: "Medication/9001",
          display: "Amoxicillin 500 mg capsule",
        },
        subject: { type: "Patient", display: "Jordan Lee" },
      },
    },
  ],
};

describe("mapPatient", () => {
  it("maps the fields the UI renders", () => {
    const resource = (
      patientBundle.entry as { resource: object }[]
    )[0].resource;
    expect(mapPatient(resource)).toEqual({
      id: "wellnessapp-demo-alex-223",
      name: "Alex Morgan",
      gender: "female",
      birthDate: "1980-01-15",
    });
  });

  it("prefers HumanName.text when present", () => {
    const resource = (
      patientBundle.entry as { resource: object }[]
    )[1].resource;
    expect(mapPatient(resource)?.name).toBe("Chris Smith");
  });

  it("keeps a Patient row but nulls missing fields", () => {
    expect(mapPatient({ resourceType: "Patient", id: "bare" })).toEqual({
      id: "bare",
      name: null,
      gender: null,
      birthDate: null,
    });
  });

  it("treats blank strings and malformed names as missing", () => {
    const mapped = mapPatient({
      resourceType: "Patient",
      id: "",
      name: [{ given: [42, null], family: 7 }, "not-an-object"],
      gender: "   ",
      birthDate: null,
    });
    expect(mapped).toEqual({
      id: null,
      name: null,
      gender: null,
      birthDate: null,
    });
  });

  it("returns null for non-Patient resources and non-objects", () => {
    expect(mapPatient({ resourceType: "Observation", id: "obs-1" })).toBeNull();
    expect(mapPatient("Patient")).toBeNull();
    expect(mapPatient(null)).toBeNull();
    expect(mapPatient(undefined)).toBeNull();
  });
});

describe("mapMedicationRequest", () => {
  it("maps the fields the UI renders", () => {
    const resource = (
      medicationRequestBundle.entry as { resource: object }[]
    )[0].resource;
    expect(mapMedicationRequest(resource)).toEqual({
      id: "50532",
      status: "active",
      intent: "order",
      medication: "Paracetamol 500 mg oral tablet",
      patientReference: "Patient/50522",
      authoredOn: "2026-09-20T12:00:00+00:00",
    });
  });

  it("falls back through medication coding display, text and reference", () => {
    const [withCoding, withReference] = medicationRequestBundle
      .entry as { resource: object }[];
    expect(mapMedicationRequest(withCoding.resource)?.medication).toBe(
      "Paracetamol 500 mg oral tablet",
    );
    expect(mapMedicationRequest(withReference.resource)).toMatchObject({
      id: "50533",
      medication: "Amoxicillin 500 mg capsule",
      patientReference: "Jordan Lee",
    });
  });

  it("falls back to subject.display when there is no reference", () => {
    const resource = (
      medicationRequestBundle.entry as { resource: object }[]
    )[1].resource;
    const bare = { ...resource, medicationReference: undefined };
    expect(mapMedicationRequest(bare)?.patientReference).toBe("Jordan Lee");
  });

  it("nulls missing fields instead of failing", () => {
    expect(
      mapMedicationRequest({ resourceType: "MedicationRequest" }),
    ).toEqual({
      id: null,
      status: null,
      intent: null,
      medication: null,
      patientReference: null,
      authoredOn: null,
    });
  });

  it("returns null for non-MedicationRequest resources and non-objects", () => {
    expect(
      mapMedicationRequest({ resourceType: "Patient", id: "p1" }),
    ).toBeNull();
    expect(mapMedicationRequest(42)).toBeNull();
  });
});

describe("mapBundle", () => {
  it("maps searchset bundles with the given resource mapper", () => {
    expect(mapBundle(patientBundle, mapPatient)).toHaveLength(2);
    expect(mapBundle(medicationRequestBundle, mapMedicationRequest)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "50532" }),
        expect.objectContaining({ id: "50533" }),
      ]),
    );
  });

  it("skips entries without resources and resources of other types", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [
        null,
        { fullUrl: "https://example.org" },
        { resource: null },
        { resource: { resourceType: "Observation", id: "obs-1" } },
        { resource: { resourceType: "Patient", id: "kept" } },
      ],
    };
    expect(mapBundle(bundle, mapPatient)).toEqual([
      { id: "kept", name: null, gender: null, birthDate: null },
    ]);
  });

  it("yields empty arrays for malformed bundles instead of throwing", () => {
    const malformed: unknown[] = [
      null,
      undefined,
      "not-a-bundle",
      42,
      {},
      { resourceType: "Bundle" },
      { entry: "not-an-array" },
      { entry: [null, 7, "nope"] },
    ];
    for (const bundle of malformed) {
      expect(() => mapBundle(bundle, mapPatient)).not.toThrow();
      expect(mapBundle(bundle, mapPatient)).toEqual([]);
    }
  });
});
