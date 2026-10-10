/** Human-readable sentence for an audit row; raw details stay available. */
export function describeAudit(row: {
  action: string;
  entityType: string;
  entityId: number;
  details: unknown;
}): string {
  const details = (row.details ?? {}) as Record<string, unknown>;
  if (row.action === "order.create") {
    return `created order #${row.entityId} for ${String(details.patientName ?? "patient")}`;
  }
  if (row.action === "inventory.adjust") {
    return `adjusted stock of ${String(details.medicationName ?? "medication")} from ${String(details.from ?? "?")} to ${String(details.to ?? "?")}`;
  }
  if (row.action === "order.fill") {
    const stock =
      details.stockBefore != null && details.stockAfter != null
        ? `, stock ${String(details.stockBefore)} → ${String(details.stockAfter)}`
        : "";
    return `filled order #${row.entityId} (qty ${String(details.quantity ?? "?")})${stock}`;
  }
  if (row.action === "user.login") {
    return "signed in";
  }
  if (typeof details.from === "string" && typeof details.to === "string") {
    return `moved order #${row.entityId} from ${details.from} to ${details.to}`;
  }
  return `updated ${row.entityType} #${row.entityId}`;
}
