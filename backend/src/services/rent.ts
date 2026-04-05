import type { BillingFrequency } from "../models/Invitation";

export type LeaseRentInput = {
  startDate: Date;
  endDate: Date | null;
  rentAmount: number;
  billingFrequency: BillingFrequency;
};

function addMonths(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  const day = out.getDate();
  out.setMonth(out.getMonth() + n);
  if (out.getDate() < day) {
    out.setDate(0);
  }
  return out;
}

function addYears(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setFullYear(out.getFullYear() + n);
  return out;
}

/**
 * Sum of rent installments whose due date falls on or before `asOf`,
 * from lease start, stepping monthly or yearly. Stops after `endDate` if set.
 */
export function computeExpectedRentThrough(lease: LeaseRentInput, asOf: Date): number {
  let total = 0;
  let period = new Date(lease.startDate.getTime());
  const cap = new Date(asOf.getTime());
  const end = lease.endDate ? new Date(lease.endDate.getTime()) : null;

  while (period <= cap) {
    if (end && period > end) {
      break;
    }
    total += lease.rentAmount;
    period =
      lease.billingFrequency === "yearly"
        ? addYears(period, 1)
        : addMonths(period, 1);
  }

  return Math.round(total * 100) / 100;
}

export function sumPayments(payments: { amount: number }[]): number {
  const s = payments.reduce((acc, p) => acc + p.amount, 0);
  return Math.round(s * 100) / 100;
}

export function computeBalance(expectedTotal: number, totalPaid: number): number {
  return Math.round((expectedTotal - totalPaid) * 100) / 100;
}
