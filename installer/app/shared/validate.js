/**
 * Shared validation helpers.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * True only if `value` is a real calendar date in YYYY-MM-DD form.
 * Rejects impossible dates like 2024-02-30 or 2024-13-01.
 */
export function isValidYYYYMMDD(value) {
    if (!DATE_RE.test(value))
        return false;
    const [y, m, d] = value.split('-').map(Number);
    if (y < 1900 || y > 2100)
        return false;
    if (m < 1 || m > 12)
        return false;
    if (d < 1 || d > 31)
        return false;
    const date = new Date(Date.UTC(y, m - 1, d));
    return (date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d);
}
/** Current date in the office PC's local timezone, formatted YYYY-MM-DD. */
export function todayLocalYYYYMMDD() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
//# sourceMappingURL=validate.js.map