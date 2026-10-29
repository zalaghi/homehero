type DebtTransactionLike = {
  type: "LOAN_GIVEN" | "DEBT_COLLECTED";
  amountCents: number;
  voidedAt?: Date | string | null;
};

export function calculateDebtBalance(input: {
  openingDebtCents: number;
  transactions: DebtTransactionLike[];
}): number {
  return (
    input.openingDebtCents +
    input.transactions.reduce((sum, tx) => {
      if (tx.voidedAt) return sum;
      return tx.type === "LOAN_GIVEN" ? sum + tx.amountCents : sum - tx.amountCents;
    }, 0)
  );
}

export function calculateDebtPaidTotal(transactions: DebtTransactionLike[]): number {
  return transactions.reduce((sum, tx) => {
    if (tx.voidedAt) return sum;
    return tx.type === "DEBT_COLLECTED" ? sum + tx.amountCents : sum;
  }, 0);
}

export function calculateDebtSnapshot<T extends DebtTransactionLike>(input: {
  openingDebtCents: number;
  transactions: T[];
}): {
  activeTransactions: T[];
  balanceCents: number;
  paidTotalCents: number;
} {
  const activeTransactions = input.transactions.filter((tx) => !tx.voidedAt);
  return {
    activeTransactions,
    balanceCents: calculateDebtBalance({
      openingDebtCents: input.openingDebtCents,
      transactions: activeTransactions,
    }),
    paidTotalCents: calculateDebtPaidTotal(activeTransactions),
  };
}
