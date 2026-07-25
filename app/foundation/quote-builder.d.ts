export type QuoteBuilderCalculation = {
  roofingSquares: number;
  materialAmount: number;
  laborAmount: number;
  tearoffDisposalAmount: number;
  permitDeliveryAmount: number;
  allowanceAmount: number;
  baseOtherAmount: number;
  directCost: number;
  overheadAmount: number;
  profitAmount: number;
  otherAmount: number;
  totalAmount: number;
};

export function calculateQuoteBuilder(
  input: Record<string, string | number>,
): QuoteBuilderCalculation;

export function buildScopeSummary(input: {
  materialSystem: string;
  roofingSquares: number;
  selections: string[];
}): string;
