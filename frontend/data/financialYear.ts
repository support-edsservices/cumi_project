export const FINANCIAL_YEAR_START_MONTH = 4;
export const FINANCIAL_YEAR_START_DAY = 1;

export interface FinancialYearRange {
  startDate: string;
  endDate: string;
  label: string;
}

export function getFinancialYearRange(referenceDate = new Date()): FinancialYearRange {
  const startYear = referenceDate.getMonth() + 1 >= FINANCIAL_YEAR_START_MONTH
    ? referenceDate.getFullYear()
    : referenceDate.getFullYear() - 1;
  const start = new Date(startYear, FINANCIAL_YEAR_START_MONTH - 1, FINANCIAL_YEAR_START_DAY);
  const end = new Date(startYear + 1, FINANCIAL_YEAR_START_MONTH - 1, FINANCIAL_YEAR_START_DAY - 1);
  const nextYear = String((startYear + 1) % 100).padStart(2, '0');
  const toISODate = (date: Date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  );
  const startDate = toISODate(start);
  const endDate = toISODate(end);
  const formatDate = (date: Date) => (
    `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
  );

  return {
    startDate,
    endDate,
    label: `FY ${startYear}-${nextYear} (${formatDate(start)} – ${formatDate(end)})`,
  };
}
