export type IsoDate = `${number}-${number}-${number}`;

export type AttendanceDayInput = {
  date: IsoDate;
  worked: boolean;
  authorizedExtra: boolean;
};

export type CardExpenseInput = {
  date: IsoDate;
  amountCents: number;
};

export type DebtTransactionType = "LOAN_GIVEN" | "DEBT_COLLECTED";

export type DebtTransactionInput = {
  date: IsoDate;
  type: DebtTransactionType;
  amountCents: number;
};

export type PayFrequency = "WEEKLY_ISO" | "MONTHLY";

export type PayPeriod = {
  frequency: PayFrequency;
  startDate: IsoDate; // inclusive
  endDate: IsoDate; // inclusive
};

export type PayrollTotals = {
  validDays: number;
  grossPayCents: number;
  cardExpensesCents: number;
  loansCents: number;
  debtCollectedCents: number;
  netPayCents: number;
  debtStartCents: number;
  debtEndCents: number;
};

