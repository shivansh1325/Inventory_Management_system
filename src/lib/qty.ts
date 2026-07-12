/**
 * Exact quantity arithmetic.
 *
 * SQLite (Prisma) has no Decimal type, so every quantity/cost is stored as an
 * integer in "milli-units" (value x 1000 — 3 decimal places). All math in this
 * app goes through these helpers so floating-point drift is impossible:
 * parsing is string-based, arithmetic is integer-only.
 */

export const SCALE = 1000;

/** Parse user input ("2.5", "80", "0.125") to exact milli-units. Throws on bad input. */
export function toMilli(input: string | number): number {
  const s = String(input).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid quantity: "${input}"`);
  }
  const neg = s.startsWith("-");
  const [intPart, fracRaw = ""] = (neg ? s.slice(1) : s).split(".");
  if (fracRaw.length > 3) {
    throw new Error(`Max 3 decimal places supported, got "${input}"`);
  }
  const frac = fracRaw.padEnd(3, "0");
  const value = parseInt(intPart, 10) * SCALE + parseInt(frac || "0", 10);
  if (!Number.isSafeInteger(value)) throw new Error(`Quantity out of range: "${input}"`);
  return neg ? -value : value;
}

/** Format milli-units for display: 2500 -> "2.5", 8000 -> "8". */
export function fmtQty(milli: number): string {
  const neg = milli < 0;
  const abs = Math.abs(milli);
  const int = Math.floor(abs / SCALE);
  const frac = String(abs % SCALE).padStart(3, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? "." + frac : ""}`;
}

/** required = qtyPerUnit x qty, both milli. Exact for integer intermediate. */
export function mulQty(aMilli: number, bMilli: number): number {
  const product = aMilli * bMilli;
  if (!Number.isSafeInteger(product)) throw new Error("Quantity overflow");
  // product is (a*b*10^6); dividing by SCALE keeps milli. Integer-exact when
  // total decimal places <= 3, which zod input rules guarantee.
  return Math.round(product / SCALE);
}

/** Whole units buildable: floor(stock / perUnit). */
export function divFloor(stockMilli: number, perUnitMilli: number): number {
  if (perUnitMilli <= 0) return 0;
  return Math.floor(stockMilli / perUnitMilli);
}

/** Format milli-currency: 12500 -> "12.50" (2dp for money display). */
export function fmtMoney(milli: number): string {
  return (milli / SCALE).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
