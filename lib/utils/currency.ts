/**
 * Currency formatting utilities for Indian Rupee (INR)
 */

export type DentalProcedure = 
  | 'consultation'
  | 'cleaning'
  | 'filling'
  | 'root_canal'
  | 'crown'
  | 'extraction'
  | 'teeth_whitening'
  | 'implant'
  | 'orthodontics'
  | 'periodontal_treatment'
  | 'oral_surgery'
  | 'dental_checkup'
  | 'emergency_treatment'
  | 'dentures'
  | 'bridge'
  | 'scaling'
  | 'polishing'
  | 'fluoride_treatment'
  | 'sealant'
  | 'x_ray'

/**
 * Standard pricing for dental procedures in INR
 */
export const DENTAL_PROCEDURE_PRICES: Record<DentalProcedure, number> = {
  consultation: 500,
  dental_checkup: 300,
  cleaning: 1500,
  scaling: 1200,
  polishing: 800,
  filling: 2000,
  root_canal: 8000,
  crown: 12000,
  extraction: 1500,
  teeth_whitening: 15000,
  implant: 50000,
  orthodontics: 75000,
  periodontal_treatment: 5000,
  oral_surgery: 20000,
  emergency_treatment: 2000,
  dentures: 25000,
  bridge: 18000,
  fluoride_treatment: 600,
  sealant: 1000,
  x_ray: 800,
}

/**
 * Format number as Indian Rupee currency
 * @param amount - Amount in rupees
 * @param showSymbol - Whether to show ₹ symbol (default: true)
 * @returns Formatted currency string
 */
export function formatINR(amount: number, showSymbol: boolean = true): string {
  if (amount === 0) {
    return showSymbol ? '₹0' : '0'
  }

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  if (!showSymbol) {
    return formatter.format(amount).replace('₹', '').trim()
  }

  return formatter.format(amount)
}

/**
 * Format number as short form Indian Rupee currency (K, L, Cr)
 * @param amount - Amount in rupees
 * @param showSymbol - Whether to show ₹ symbol (default: true)
 * @returns Formatted currency string in short form
 */
export function formatINRShort(amount: number, showSymbol: boolean = true): string {
  if (amount === 0) {
    return showSymbol ? '₹0' : '0'
  }

  const prefix = showSymbol ? '₹' : ''

  if (amount >= 10000000) { // 1 Crore
    return `${prefix}${(amount / 10000000).toFixed(1)}Cr`
  } else if (amount >= 100000) { // 1 Lakh
    return `${prefix}${(amount / 100000).toFixed(1)}L`
  } else if (amount >= 1000) { // 1 Thousand
    return `${prefix}${(amount / 1000).toFixed(1)}K`
  } else {
    return `${prefix}${amount.toLocaleString('en-IN')}`
  }
}

/**
 * Parse INR string back to number
 * @param currencyString - Formatted currency string
 * @returns Numeric value
 */
export function parseINR(currencyString: string): number {
  // Remove currency symbol and commas
  const cleanString = currencyString.replace(/[₹,\s]/g, '')
  
  // Handle short forms
  if (cleanString.includes('Cr')) {
    return parseFloat(cleanString.replace('Cr', '')) * 10000000
  } else if (cleanString.includes('L')) {
    return parseFloat(cleanString.replace('L', '')) * 100000
  } else if (cleanString.includes('K')) {
    return parseFloat(cleanString.replace('K', '')) * 1000
  }
  
  return parseFloat(cleanString) || 0
}

/**
 * Calculate percentage of amount
 * @param amount - Base amount
 * @param percentage - Percentage to calculate
 * @returns Calculated amount
 */
export function calculatePercentage(amount: number, percentage: number): number {
  return (amount * percentage) / 100
}

/**
 * Calculate tax (GST) for dental services
 * @param amount - Base amount
 * @param gstRate - GST rate in percentage (default: 18%)
 * @returns Object with base amount, tax, and total
 */
export function calculateGST(amount: number, gstRate: number = 18) {
  const tax = calculatePercentage(amount, gstRate)
  const total = amount + tax
  
  return {
    baseAmount: amount,
    tax,
    total,
    gstRate
  }
}

/**
 * Get procedure price by name
 * @param procedureName - Name of the dental procedure
 * @returns Price in INR or 0 if not found
 */
export function getProcedurePrice(procedureName: string): number {
  const normalizedName = procedureName.toLowerCase().replace(/\s+/g, '_') as DentalProcedure
  return DENTAL_PROCEDURE_PRICES[normalizedName] || 0
}

/**
 * Calculate discount amount
 * @param amount - Original amount
 * @param discountPercentage - Discount percentage
 * @returns Discounted amount
 */
export function applyDiscount(amount: number, discountPercentage: number): number {
  const discount = calculatePercentage(amount, discountPercentage)
  return amount - discount
}

/**
 * Format amount as a range
 * @param minAmount - Minimum amount
 * @param maxAmount - Maximum amount
 * @param showSymbol - Whether to show ₹ symbol
 * @returns Formatted range string
 */
export function formatINRRange(minAmount: number, maxAmount: number, showSymbol: boolean = true): string {
  return `${formatINR(minAmount, showSymbol)} - ${formatINR(maxAmount, showSymbol)}`
}