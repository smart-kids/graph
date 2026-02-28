/**
 * Safely parse a stored JSON array field.
 * Returns [] for any invalid input (null, undefined, empty string, malformed JSON).
 * Also handles the case where Waterline has already parsed the value into an array.
 */
export const safeParseJSON = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};
