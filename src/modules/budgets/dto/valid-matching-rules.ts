import { ValidateBy } from 'class-validator';
import { matchingRulesError } from '../matching-rule-validation';

export function ValidMatchingRules(): PropertyDecorator {
  return ValidateBy({
    name: 'validMatchingRules',
    validator: {
      validate: (value: unknown) => matchingRulesError(value) === undefined,
      defaultMessage: (args) =>
        matchingRulesError(args?.value) ?? 'Invalid matchingRules',
    },
  });
}
