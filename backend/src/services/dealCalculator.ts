import { PropertyType } from '@prisma/client';
import { logger } from '../utils/logger';

export interface WholesaleInputs {
  arv: number;
  rehab: number;
  holding: number;
  closing: number;
  wholesaleFee: number;
  buyerMargin: number; // e.g., 0.20 for 20%
}

export interface BrrrrInputs {
  arv: number;
  rehab: number;
  holding: number;
  closing: number;
  targetLtv: number; // e.g., 0.75 for 75%
  buffer: number;
}

export interface RentalInputs {
  monthlyRent: number;
  expenses: number; // monthly
  desiredDscr: number; // e.g., 1.25
  downPayment: number; // e.g., 0.25 for 25%
  interestRate: number; // e.g., 0.07 for 7%
  loanTermYears: number;
}

export interface MultifamilyInputs {
  units: number;
  avgRentPerUnit: number;
  vacancyRate: number; // e.g., 0.05 for 5%
  operatingExpenseRatio: number; // e.g., 0.45 for 45%
  capRate: number; // e.g., 0.06 for 6%
}

export interface CommercialInputs {
  noi: number; // Net Operating Income
  capRate: number; // e.g., 0.07 for 7%
}

export interface LandInputs {
  marketValue: number;
  zoning: string;
  utilities: boolean;
  accessRoad: boolean;
  offerPct: number; // e.g., 0.35 for 35% of market
}

export interface CalculatorResults {
  strategy: string;
  maxOffer: number;
  explanation: string;
  assumptions: string[];
  rangeMin?: number;
  rangeMax?: number;
}

/**
 * Deal Calculator - provides offer ranges for different investment strategies
 * All calculations are conservative and investor-friendly
 */
export class DealCalculator {
  /**
   * Calculate Maximum Allowable Offer (MAO) for wholesale deals
   * Formula: ARV * (1 - buyer_margin) - rehab - holding - closing - wholesale_fee
   */
  calculateWholesale(inputs: WholesaleInputs): CalculatorResults {
    const { arv, rehab, holding, closing, wholesaleFee, buyerMargin } = inputs;

    const maxOffer = arv * (1 - buyerMargin) - rehab - holding - closing - wholesaleFee;

    // Conservative range: +/- 5%
    const rangeMin = maxOffer * 0.95;
    const rangeMax = maxOffer * 1.05;

    return {
      strategy: 'Wholesale',
      maxOffer: Math.round(maxOffer),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
      explanation: `Based on ARV of $${arv.toLocaleString()} with ${(buyerMargin * 100).toFixed(0)}% buyer margin`,
      assumptions: [
        `ARV: $${arv.toLocaleString()}`,
        `Rehab: $${rehab.toLocaleString()}`,
        `Buyer needs ${(buyerMargin * 100).toFixed(0)}% margin`,
        `Wholesale fee: $${wholesaleFee.toLocaleString()}`,
      ],
    };
  }

  /**
   * Calculate BRRRR max purchase price
   * Goal: Buy, Rehab, Rent, Refinance, Repeat
   * Formula: (ARV * target_LTV) - rehab - costs - buffer
   */
  calculateBrrrr(inputs: BrrrrInputs): CalculatorResults {
    const { arv, rehab, holding, closing, targetLtv, buffer } = inputs;

    const refinanceAmount = arv * targetLtv;
    const maxOffer = refinanceAmount - rehab - holding - closing - buffer;

    // Conservative range
    const rangeMin = maxOffer * 0.90;
    const rangeMax = maxOffer * 1.0;

    return {
      strategy: 'BRRRR',
      maxOffer: Math.round(maxOffer),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
      explanation: `Max buy price to pull out capital at ${(targetLtv * 100).toFixed(0)}% LTV refinance`,
      assumptions: [
        `ARV: $${arv.toLocaleString()}`,
        `Refinance at ${(targetLtv * 100).toFixed(0)}% LTV: $${refinanceAmount.toLocaleString()}`,
        `Rehab: $${rehab.toLocaleString()}`,
        `Buffer: $${buffer.toLocaleString()}`,
      ],
    };
  }

  /**
   * Calculate rental property max price based on DSCR
   * DSCR = Net Operating Income / Debt Service
   */
  calculateRental(inputs: RentalInputs): CalculatorResults {
    const { monthlyRent, expenses, desiredDscr, downPayment, interestRate, loanTermYears } = inputs;

    const monthlyNoi = monthlyRent - expenses;
    const annualNoi = monthlyNoi * 12;

    // Calculate max annual debt service
    const maxAnnualDebtService = annualNoi / desiredDscr;
    const maxMonthlyPayment = maxAnnualDebtService / 12;

    // Calculate max loan amount (present value of annuity)
    const monthlyRate = interestRate / 12;
    const numPayments = loanTermYears * 12;
    const maxLoanAmount =
      maxMonthlyPayment * ((1 - Math.pow(1 + monthlyRate, -numPayments)) / monthlyRate);

    // Max purchase price = loan amount / (1 - down payment %)
    const maxPurchasePrice = maxLoanAmount / (1 - downPayment);

    // Conservative range
    const rangeMin = maxPurchasePrice * 0.85;
    const rangeMax = maxPurchasePrice * 1.0;

    return {
      strategy: 'Buy & Hold (Rental)',
      maxOffer: Math.round(maxPurchasePrice),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
      explanation: `Max price for ${desiredDscr}x DSCR with ${(downPayment * 100).toFixed(0)}% down`,
      assumptions: [
        `Monthly rent: $${monthlyRent.toLocaleString()}`,
        `Monthly expenses: $${expenses.toLocaleString()}`,
        `Monthly NOI: $${monthlyNoi.toLocaleString()}`,
        `Required DSCR: ${desiredDscr}x`,
        `Interest rate: ${(interestRate * 100).toFixed(2)}%`,
      ],
    };
  }

  /**
   * Calculate multifamily value and offer range
   * Based on Cap Rate and NOI
   */
  calculateMultifamily(inputs: MultifamilyInputs): CalculatorResults {
    const { units, avgRentPerUnit, vacancyRate, operatingExpenseRatio, capRate } = inputs;

    const grossMonthlyIncome = units * avgRentPerUnit;
    const effectiveMonthlyIncome = grossMonthlyIncome * (1 - vacancyRate);
    const annualEffectiveIncome = effectiveMonthlyIncome * 12;

    const operatingExpenses = annualEffectiveIncome * operatingExpenseRatio;
    const noi = annualEffectiveIncome - operatingExpenses;

    const estimatedValue = noi / capRate;

    // Offer range: 85-95% of value for negotiation room
    const rangeMin = estimatedValue * 0.85;
    const rangeMax = estimatedValue * 0.95;
    const targetOffer = estimatedValue * 0.90;

    return {
      strategy: 'Multifamily',
      maxOffer: Math.round(targetOffer),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
      explanation: `Value based on ${(capRate * 100).toFixed(1)}% cap rate and $${noi.toLocaleString()} NOI`,
      assumptions: [
        `${units} units at $${avgRentPerUnit}/unit/month`,
        `Gross annual income: $${(grossMonthlyIncome * 12).toLocaleString()}`,
        `Vacancy rate: ${(vacancyRate * 100).toFixed(0)}%`,
        `Operating expenses: ${(operatingExpenseRatio * 100).toFixed(0)}%`,
        `NOI: $${noi.toLocaleString()}`,
        `Cap rate: ${(capRate * 100).toFixed(1)}%`,
      ],
    };
  }

  /**
   * Calculate commercial property value
   * Value = NOI / Cap Rate
   */
  calculateCommercial(inputs: CommercialInputs): CalculatorResults {
    const { noi, capRate } = inputs;

    const estimatedValue = noi / capRate;

    // Offer range: 85-95% of value
    const rangeMin = estimatedValue * 0.85;
    const rangeMax = estimatedValue * 0.95;
    const targetOffer = estimatedValue * 0.90;

    return {
      strategy: 'Commercial',
      maxOffer: Math.round(targetOffer),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
      explanation: `Value based on ${(capRate * 100).toFixed(1)}% cap rate`,
      assumptions: [
        `Annual NOI: $${noi.toLocaleString()}`,
        `Cap rate: ${(capRate * 100).toFixed(1)}%`,
        `Estimated value: $${estimatedValue.toLocaleString()}`,
      ],
    };
  }

  /**
   * Calculate land offer
   * More art than science - based on percentage of market value
   */
  calculateLand(inputs: LandInputs): CalculatorResults {
    const { marketValue, zoning, utilities, accessRoad, offerPct } = inputs;

    let adjustedOfferPct = offerPct;

    // Adjust based on land characteristics
    if (!utilities) adjustedOfferPct -= 0.05; // Reduce 5% if no utilities
    if (!accessRoad) adjustedOfferPct -= 0.03; // Reduce 3% if no access road

    const targetOffer = marketValue * adjustedOfferPct;

    // Wide range for land deals
    const rangeMin = targetOffer * 0.80;
    const rangeMax = targetOffer * 1.10;

    return {
      strategy: 'Land',
      maxOffer: Math.round(targetOffer),
      rangeMin: Math.round(rangeMin),
      rangeMax: Math.round(rangeMax),
      explanation: `${(adjustedOfferPct * 100).toFixed(0)}% of market value (adjusted for characteristics)`,
      assumptions: [
        `Market value: $${marketValue.toLocaleString()}`,
        `Zoning: ${zoning}`,
        `Utilities: ${utilities ? 'Yes' : 'No'}`,
        `Access road: ${accessRoad ? 'Yes' : 'No'}`,
        `Base offer %: ${(offerPct * 100).toFixed(0)}%`,
      ],
    };
  }

  /**
   * Calculate all applicable strategies for a property
   */
  calculateAllStrategies(
    propertyType: PropertyType,
    inputs: {
      arv?: number;
      rehab?: number;
      rent?: number;
      units?: number;
      noi?: number;
      landValue?: number;
      [key: string]: any;
    }
  ): CalculatorResults[] {
    const results: CalculatorResults[] = [];

    try {
      switch (propertyType) {
        case PropertyType.SFR:
          // Calculate wholesale and BRRRR for SFR
          if (inputs.arv && inputs.rehab) {
            results.push(
              this.calculateWholesale({
                arv: inputs.arv,
                rehab: inputs.rehab || 0,
                holding: inputs.holding || 5000,
                closing: inputs.closing || 3000,
                wholesaleFee: inputs.wholesaleFee || 10000,
                buyerMargin: inputs.buyerMargin || 0.20,
              })
            );

            results.push(
              this.calculateBrrrr({
                arv: inputs.arv,
                rehab: inputs.rehab || 0,
                holding: inputs.holding || 5000,
                closing: inputs.closing || 3000,
                targetLtv: inputs.targetLtv || 0.75,
                buffer: inputs.buffer || 10000,
              })
            );
          }

          // Calculate rental if rent estimate available
          if (inputs.rent) {
            results.push(
              this.calculateRental({
                monthlyRent: inputs.rent,
                expenses: inputs.expenses || inputs.rent * 0.4,
                desiredDscr: inputs.desiredDscr || 1.25,
                downPayment: inputs.downPayment || 0.25,
                interestRate: inputs.interestRate || 0.07,
                loanTermYears: inputs.loanTermYears || 30,
              })
            );
          }
          break;

        case PropertyType.MULTIFAMILY:
          if (inputs.units && inputs.avgRentPerUnit) {
            results.push(
              this.calculateMultifamily({
                units: inputs.units,
                avgRentPerUnit: inputs.avgRentPerUnit,
                vacancyRate: inputs.vacancyRate || 0.05,
                operatingExpenseRatio: inputs.operatingExpenseRatio || 0.45,
                capRate: inputs.capRate || 0.06,
              })
            );
          }
          break;

        case PropertyType.COMMERCIAL:
          if (inputs.noi) {
            results.push(
              this.calculateCommercial({
                noi: inputs.noi,
                capRate: inputs.capRate || 0.07,
              })
            );
          }
          break;

        case PropertyType.LAND:
          if (inputs.landValue || inputs.arv) {
            results.push(
              this.calculateLand({
                marketValue: inputs.landValue || inputs.arv || 0,
                zoning: inputs.zoning || 'Unknown',
                utilities: inputs.utilities !== false,
                accessRoad: inputs.accessRoad !== false,
                offerPct: inputs.offerPct || 0.35,
              })
            );
          }
          break;
      }
    } catch (error) {
      logger.error('Error calculating strategies:', error);
    }

    return results;
  }
}

export const dealCalculator = new DealCalculator();
