import { MOVEMENT_TYPES } from "@/lib/validation";

export type MovementSearchParams = {
  type?: string;
  item?: string; // "c:<componentId>" | "p:<productId>"
  warehouse?: string;
  from?: string; // yyyy-mm-dd
  to?: string;
};

export function buildMovementWhere(searchParams: MovementSearchParams) {
  const where: Record<string, unknown> = {};
  if (searchParams.type && MOVEMENT_TYPES.includes(searchParams.type as never)) {
    where.type = searchParams.type;
  }
  if (searchParams.warehouse) where.warehouseId = searchParams.warehouse;
  if (searchParams.item) {
    const [kind, id] = searchParams.item.split(":");
    if (kind === "c") where.componentId = id;
    if (kind === "p") where.productId = id;
  }
  const createdAt: Record<string, Date> = {};
  if (searchParams.from) createdAt.gte = new Date(searchParams.from);
  if (searchParams.to) createdAt.lte = new Date(searchParams.to + "T23:59:59.999");
  if (Object.keys(createdAt).length) where.createdAt = createdAt;
  return where;
}
