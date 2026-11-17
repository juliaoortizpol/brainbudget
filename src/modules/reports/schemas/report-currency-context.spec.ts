import { model, Types } from 'mongoose';
import { BudgetPeriodReportSchema } from './budget-period-report.schema';
import { dopPlanningContext } from '../../budgets/currency-policy';
import { BudgetSchema } from '../../budgets/schemas/budget.schema';
import { TransactionSchema } from '../../transactions/schemas/transaction.schema';
import { reportCurrencyError } from './report-currency-context.schema';

describe('TC4/TC5 report currency foundation (Mongoose validation, no database)', () => {
  const Report = model('CurrencyReportTest', BudgetPeriodReportSchema);
  const Budget = model('CurrencyBudgetTest', BudgetSchema);
  const Transaction = model('CurrencyTransactionTest', TransactionSchema);
  const purchaseId = new Types.ObjectId().toString();
  const context = () => ({
    version: 1,
    planning: dopPlanningContext(),
    actualsCurrency: 'DOP',
    complete: true,
    unresolvedTransactionIds: [],
    transactions: [
      {
        transactionId: purchaseId,
        budgetItemId: null,
        currency: 'DOP',
        version: 1,
        origin: 'mail-parser',
      },
    ],
  });
  const report = (currencyContext: unknown) =>
    new Report({
      budgetId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      budgetName: 'Synthetic',
      periodType: 'custom',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
      closedAt: new Date('2024-02-01'),
      totals: {
        totalPlanned: 100,
        totalActualIncome: 0,
        totalActualExpense: 100,
        totalVariance: 0,
      },
      items: [],
      currencyContext,
    });

  it('round-trips explicit context and original IDs without account dependencies', async () => {
    const stored = report(context());
    await expect(stored.validate()).resolves.toBeUndefined();
    const before = stored.toObject().currencyContext;
    const account = { currency: 'DOP' };
    account.currency = 'USD';
    const reloaded = Report.hydrate(stored.toObject());
    expect(reloaded.currencyContext).toMatchObject(context());
    expect(reloaded.toObject().currencyContext).toEqual(before);
    expect(account.currency).toBe('USD');
  });

  it.each([
    undefined,
    { ...context(), complete: false },
    { ...context(), actualsCurrency: 'USD' },
    { ...context(), unresolvedTransactionIds: [purchaseId] },
    {
      ...context(),
      transactions: [{ ...context().transactions[0], currency: 'USD' }],
    },
    {
      ...context(),
      transactions: [{ ...context().transactions[0], currency: undefined }],
    },
    { ...context(), planning: undefined },
  ])('blocks unresolved or unsupported context %j', async (invalid) => {
    await expect(report(invalid).validate()).rejects.toThrow();
  });

  it('does not hydrate historical transaction, budget or report currency defaults', () => {
    const id = new Types.ObjectId();
    const legacy = Transaction.hydrate({
      _id: id,
      name: 'Synthetic legacy',
      amount: 30,
    });
    expect(legacy.currency).toBeUndefined();
    expect(legacy.currencyOrigin).toBeUndefined();
    expect(legacy._id).toEqual(id);
    expect(Budget.hydrate({ _id: id }).currencyContext).toBeUndefined();
    expect(Report.hydrate({ _id: id }).currencyContext).toBeUndefined();
    expect(reportCurrencyError(undefined)).toContain('Explicit DOP');
  });
});
