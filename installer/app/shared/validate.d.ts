/**
 * Shared validation helpers.
 */
/**
 * True only if `value` is a real calendar date in YYYY-MM-DD form.
 * Rejects impossible dates like 2024-02-30 or 2024-13-01.
 */
export declare function isValidYYYYMMDD(value: string): boolean;
/** Current date in the office PC's local timezone, formatted YYYY-MM-DD. */
export declare function todayLocalYYYYMMDD(): string;
//# sourceMappingURL=validate.d.ts.map