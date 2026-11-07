import { MerchantNormalizationService } from '../transactions/merchant-normalization.service';

const normalization = new MerchantNormalizationService();

/** Validate replacement payloads without changing saved display values. */
export function matchingRulesError(rules: unknown): string | undefined {
  if (!Array.isArray(rules)) return 'matchingRules must be an array';
  if (rules.length > 100)
    return 'matchingRules allows at most 100 rules per item';
  const ids = new Set<string>();
  const keys = new Set<string>();
  for (const [index, rule] of rules.entries()) {
    const prefix = `matchingRules[${index}]`;
    if (!rule || typeof rule !== 'object')
      return `${prefix} must be a rule object`;
    const { id, field, operator, value, source } = rule as Record<
      string,
      unknown
    >;
    if (typeof id !== 'string' || !id.trim() || id.length > 128) {
      return `${prefix}.id must be nonblank and at most 128 characters`;
    }
    if (ids.has(id))
      return `${prefix}.id duplicates another rule ID in this item`;
    ids.add(id);
    if (field !== 'merchant' && field !== 'description')
      return `${prefix}.field must be merchant or description`;
    if (operator !== 'equals' && operator !== 'contains')
      return `${prefix}.operator must be equals or contains`;
    if (source !== 'user' && source !== 'learned' && source !== 'suggested')
      return `${prefix}.source must be user, learned or suggested`;
    if (
      typeof value !== 'string' ||
      value.length > 256 ||
      !normalization.normalize(value)
    ) {
      return `${prefix}.value must contain a searchable keyword and be at most 256 characters`;
    }
    const key = JSON.stringify([
      field,
      operator,
      normalization.normalize(value),
    ]);
    if (keys.has(key))
      return `${prefix} duplicates a field/operator/normalized value in this item`;
    keys.add(key);
  }
  return undefined;
}
