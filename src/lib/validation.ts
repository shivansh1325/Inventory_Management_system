import { z } from "zod";

export const UNITS = ["pcs", "kg", "g", "m", "cm", "L", "ml"] as const;
export type Unit = (typeof UNITS)[number];

/** Units that only make sense in whole numbers. */
export const WHOLE_UNITS: Unit[] = ["pcs"];

export const RUN_STATUSES = ["DRAFT", "COMPLETED", "CANCELLED"] as const;
export const MOVEMENT_TYPES = [
  "RECEIPT",
  "ADJUSTMENT",
  "PRODUCTION_CONSUMPTION",
  "PRODUCTION_OUTPUT",
  "RUN_REVERSAL",
  "TRANSFER_OUT",
  "TRANSFER_IN",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Decimal string with up to 3 dp — parsed to milli-units server-side. */
const qtyString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "Enter a number (max 3 decimal places)");

export const positiveQty = qtyString.refine((s) => parseFloat(s) > 0, "Must be greater than 0");
export const nonNegativeQty = qtyString;

export const componentSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(120),
  unit: z.enum(UNITS),
  minLevel: nonNegativeQty,
  unitCost: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,3})?$/, "Enter a number")
    .optional()
    .or(z.literal("")),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  supplier: z.string().trim().max(120).optional().or(z.literal("")),
});
export type ComponentInput = z.infer<typeof componentSchema>;

export const receiveStockSchema = z.object({
  componentId: z.string().min(1),
  warehouseId: z.string().optional(),
  qty: positiveQty,
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const adjustStockSchema = z.object({
  componentId: z.string().min(1),
  warehouseId: z.string().optional(),
  mode: z.enum(["SET", "DELTA"]),
  // SET: new absolute value (>= 0). DELTA: signed change.
  qty: z
    .string()
    .trim()
    .regex(/^-?\d+(\.\d{1,3})?$/, "Enter a number (max 3 decimal places)"),
  reason: z.string().trim().min(3, "A reason is mandatory for adjustments").max(300),
});

export const transferSchema = z.object({
  componentId: z.string().min(1, "Pick a component"),
  fromWarehouseId: z.string().min(1, "Pick a source warehouse"),
  toWarehouseId: z.string().min(1, "Pick a destination warehouse"),
  qty: positiveQty,
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  contact: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  terms: z.string().trim().max(200).optional().or(z.literal("")),
  leadTimeDays: z
    .string()
    .trim()
    .regex(/^\d*$/, "Whole days")
    .optional()
    .or(z.literal("")),
});

export const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["ADMIN", "MANAGER", "STORE", "OPERATOR"]),
  password: z.string().min(8, "Min 8 characters").optional().or(z.literal("")),
});

export const warehouseSchema = z.object({
  code: z.string().trim().min(1, "Code required").max(16),
  name: z.string().trim().min(1, "Name required").max(80),
});

export const requisitionSchema = z.object({
  warehouseId: z.string().min(1, "Pick a warehouse"),
  supplierId: z.string().optional().or(z.literal("")),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  submit: z.boolean().optional(),
  lines: z
    .array(z.object({ componentId: z.string().min(1), qty: positiveQty }))
    .min(1, "Add at least one line"),
});

export const settingsSchema = z.object({
  companyName: z.string().trim().min(1).max(80),
  currency: z.string().trim().min(1).max(8),
  managerApprovalLimit: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,3})?$/, "Enter a number"),
  allowNegativeStock: z.boolean(),
  lowStockAlerts: z.boolean(),
});

export const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(40),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  unit: z.enum(UNITS).default("pcs"),
});
export type ProductInput = z.infer<typeof productSchema>;

export const bomItemSchema = z.object({
  productId: z.string().min(1),
  componentId: z.string().min(1, "Pick a component"),
  qtyPerUnit: positiveQty,
});

export const productionRunSchema = z.object({
  productId: z.string().min(1, "Pick a product"),
  qty: positiveQty,
  note: z.string().trim().max(300).optional().or(z.literal("")),
});
