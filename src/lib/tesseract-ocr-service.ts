/**
 * Tesseract OCR Service
 * =====================
 * 
 * Enhanced OCR service with multiple passes, tuned parameters, and intelligent result merging
 */

import Tesseract from 'tesseract.js';
import { ReceiptDataItem } from '@/types';

const isDebugLoggingEnabled = process.env.NODE_ENV !== 'production';

const logDebug = (...args: unknown[]) => {
  if (!isDebugLoggingEnabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(...args);
};

const logError = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.error(...args);
};

export interface OCRConfidenceBreakdown {
  overall: number;
  perPass: Array<{
    passName: string;
    confidence: number;
    itemsFound: number;
  }>;
  perField: Record<string, number>;
  dataCompleteness: number;
}

export interface TesseractOCRResult {
  text: string;
  confidence: number;
  confidenceBreakdown?: OCRConfidenceBreakdown;
  items: ReceiptDataItem[];
  processingTime: number;
  errorLog: string[];
}

interface OCRPassConfig {
  name: string;
  psm: Tesseract.PSM;
  oem?: Tesseract.OEM;
  whitelist?: string;
  description: string;
}

/**
 * OCR pass configurations optimized for different receipt types
 */
const OCR_PASS_CONFIGS: OCRPassConfig[] = [
  {
    name: 'default',
    psm: Tesseract.PSM.AUTO,
    oem: Tesseract.OEM.LSTM_ONLY,
    description: 'Default pass - balanced for general text'
  },
  {
    name: 'single_column',
    psm: Tesseract.PSM.SINGLE_COLUMN,
    oem: Tesseract.OEM.LSTM_ONLY,
    description: 'Single column mode - good for itemized lists'
  },
  {
    name: 'single_block',
    psm: Tesseract.PSM.SINGLE_BLOCK,
    oem: Tesseract.OEM.LSTM_ONLY,
    description: 'Single block - treats receipt as one text block'
  },
  {
    name: 'numeric_focused',
    psm: Tesseract.PSM.SINGLE_LINE,
    oem: Tesseract.OEM.LSTM_ONLY,
    whitelist: '0123456789.,$- ',
    description: 'Numeric-focused - optimized for prices and totals'
  }
];

interface OCRPassResult {
  config: OCRPassConfig;
  text: string;
  confidence: number;
  items: ReceiptDataItem[];
  processingTime: number;
}

/**
 * Run a single OCR pass with specific configuration
 */
async function runOCRPass(
  imageDataUri: string,
  config: OCRPassConfig
): Promise<OCRPassResult> {
  const startTime = Date.now();
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logDebug(`📝 [${config.name}] OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  try {
    // Set PSM mode
    await worker.setParameters({
      tessedit_pageseg_mode: config.psm.toString()
    } as Record<string, string>);

    // Set OEM mode if specified
    if (config.oem !== undefined) {
      await worker.setParameters({
        tessedit_ocr_engine_mode: config.oem.toString()
      } as Record<string, string>);
    }

    // Set character whitelist if specified
    if (config.whitelist) {
      await worker.setParameters({
        tessedit_char_whitelist: config.whitelist
      } as Record<string, string>);
    }

    // Set additional parameters for better accuracy
    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    } as Record<string, string>);

    const { data: { text, confidence } } = await worker.recognize(imageDataUri);
    const items = parseReceiptText(text, config.name);

    return {
      config,
      text,
      confidence: confidence / 100,
      items,
      processingTime: Date.now() - startTime
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Merge results from multiple OCR passes, prioritizing higher confidence and more complete data
 */
function mergeOCRResults(results: OCRPassResult[]): TesseractOCRResult {
  logDebug('🔄 Merging results from', results.length, 'OCR passes...');

  // Sort by confidence (descending)
  const sortedResults = [...results].sort((a, b) => b.confidence - a.confidence);
  const bestResult = sortedResults[0];

  // Combine all items, prioritizing higher confidence passes
  const itemMap = new Map<string, ReceiptDataItem>();
  const seenKeys = new Set<string>();

  // Process results in order of confidence
  for (const result of sortedResults) {
    for (const item of result.items) {
      const key = `${item.label.toLowerCase()}:${item.value.toLowerCase()}`;
      
      // Only add if we haven't seen this exact item, or if current pass has higher confidence
      if (!seenKeys.has(key)) {
        itemMap.set(`${item.label}-${item.id}`, item);
        seenKeys.add(key);
      }
    }
  }

  // For critical fields (vendor, total, subtotal, tax), prefer the highest confidence value
  const criticalFields = ['vendor', 'total', 'subtotal', 'tax'];
  const criticalItems = new Map<string, ReceiptDataItem>();

  for (const field of criticalFields) {
    let bestItem: ReceiptDataItem | null = null;
    let bestConfidence = 0;

    for (const result of sortedResults) {
      const item = result.items.find(i => 
        i.label.toLowerCase().includes(field)
      );
      
      if (item && result.confidence > bestConfidence) {
        bestItem = item;
        bestConfidence = result.confidence;
      }
    }

    if (bestItem) {
      criticalItems.set(bestItem.label.toLowerCase(), bestItem);
    }
  }

  // Merge critical items with other items
  const mergedItems: ReceiptDataItem[] = [];
  const mergedKeys = new Set<string>();

  // Add critical items first
  for (const [key, item] of criticalItems) {
    mergedItems.push(item);
    mergedKeys.add(key);
  }

  // Add other items, avoiding duplicates
  for (const item of Array.from(itemMap.values())) {
    const key = item.label.toLowerCase();
    if (!mergedKeys.has(key) && !criticalItems.has(key)) {
      mergedItems.push(item);
      mergedKeys.add(key);
    }
  }

  // Calculate weighted average confidence
  const totalConfidence = sortedResults.reduce((sum, r) => sum + r.confidence, 0);
  const avgConfidence = totalConfidence / sortedResults.length;

  // Calculate per-field confidence scores
  const perFieldConfidence: Record<string, number> = {};
  const expectedFields = ['vendor', 'items', 'prices', 'subtotal', 'tax', 'total'];
  
  for (const field of expectedFields) {
    let maxFieldConfidence = 0;
    let found = false;

    for (const result of sortedResults) {
      const item = result.items.find(i => 
        i.label.toLowerCase().includes(field)
      );
      
      if (item) {
        found = true;
        maxFieldConfidence = Math.max(maxFieldConfidence, result.confidence);
      }
    }

    if (found) {
      perFieldConfidence[field] = maxFieldConfidence;
    } else {
      perFieldConfidence[field] = 0;
    }
  }

  // Calculate data completeness (percentage of expected fields found)
  const fieldsFound = Object.values(perFieldConfidence).filter(c => c > 0).length;
  const dataCompleteness = fieldsFound / expectedFields.length;

  // Calculate per-pass confidence breakdown
  const perPassBreakdown = sortedResults.map(result => ({
    passName: result.config.name,
    confidence: result.confidence,
    itemsFound: result.items.length
  }));

  // Calculate overall confidence (weighted by data completeness)
  const overallConfidence = avgConfidence * 0.7 + dataCompleteness * 0.3;

  // Combine all text (deduplicated)
  const textSet = new Set<string>();
  for (const result of sortedResults) {
    result.text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed.length > 3) {
        textSet.add(trimmed);
      }
    });
  }
  const combinedText = Array.from(textSet).join('\n');

  const totalProcessingTime = sortedResults.reduce((sum, r) => sum + r.processingTime, 0);

  logDebug('✅ Merged', mergedItems.length, 'items from', results.length, 'passes');
  logDebug('📊 Overall confidence:', (overallConfidence * 100).toFixed(1) + '%');
  logDebug('📊 Data completeness:', (dataCompleteness * 100).toFixed(1) + '%');

  return {
    text: combinedText,
    confidence: overallConfidence,
    confidenceBreakdown: {
      overall: overallConfidence,
      perPass: perPassBreakdown,
      perField: perFieldConfidence,
      dataCompleteness
    },
    items: mergedItems,
    processingTime: totalProcessingTime,
    errorLog: []
  };
}

/**
 * Extract text from an image using Tesseract OCR with multiple optimized passes
 * @param imageDataUri - The image as a data URI
 * @returns Promise with OCR results
 */
export async function extractTextWithTesseract(imageDataUri: string): Promise<TesseractOCRResult> {
  const startTime = Date.now();
  const errorLog: string[] = [];

  try {
    logDebug('🔍 Starting multi-pass Tesseract OCR analysis...');

    // Run all OCR passes in parallel for speed
    const passPromises = OCR_PASS_CONFIGS.map(config => 
      runOCRPass(imageDataUri, config).catch(error => {
        const errorMsg = `Pass "${config.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorLog.push(errorMsg);
        logError(errorMsg, error);
        return null;
      })
    );

    const passResults = await Promise.all(passPromises);
    const validResults = passResults.filter((r): r is OCRPassResult => r !== null);

    if (validResults.length === 0) {
      throw new Error('All OCR passes failed');
    }

    logDebug(`✅ Completed ${validResults.length}/${OCR_PASS_CONFIGS.length} OCR passes`);

    // Merge results from all passes
    const mergedResult = mergeOCRResults(validResults);

    const totalTime = Date.now() - startTime;
    logDebug('⏱️ Total processing time:', totalTime, 'ms');
    logDebug('📊 Final confidence:', (mergedResult.confidence * 100).toFixed(1) + '%');
    logDebug('📝 Final items count:', mergedResult.items.length);
    
    if (mergedResult.confidenceBreakdown) {
      logDebug('📈 Confidence breakdown:', {
        overall: (mergedResult.confidenceBreakdown.overall * 100).toFixed(1) + '%',
        dataCompleteness: (mergedResult.confidenceBreakdown.dataCompleteness * 100).toFixed(1) + '%',
        perPass: mergedResult.confidenceBreakdown.perPass.map(p => 
          `${p.passName}: ${(p.confidence * 100).toFixed(1)}% (${p.itemsFound} items)`
        ),
        perField: Object.entries(mergedResult.confidenceBreakdown.perField).map(([field, conf]) => 
          `${field}: ${(conf * 100).toFixed(1)}%`
        )
      });
    }

    return {
      ...mergedResult,
      processingTime: totalTime,
      errorLog
    };

  } catch (error) {
    const errorMsg = `Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errorLog.push(errorMsg);
    logError(errorMsg, error);

    return {
      text: '',
      confidence: 0,
      items: [],
      processingTime: Date.now() - startTime,
      errorLog
    };
  }
}

/**
 * Parse OCR text into structured receipt data
 * @param text - Raw OCR text
 * @param passName - Name of the OCR pass (for debugging)
 * @returns Array of structured receipt items
 */
function parseReceiptText(text: string, passName = 'unknown'): ReceiptDataItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  logDebug(`📋 [${passName}] Parsing ${lines.length} lines...`);

  let vendor: string | null = null;
  const itemNames: string[] = [];
  const itemPrices: string[] = [];
  let subtotal: string | null = null;
  let tax: string | null = null;
  let total: string | null = null;

  for (const line of lines) {
    if (!vendor && isVendorLine(line)) {
      vendor = line;
      continue;
    }

    if (!subtotal) {
      const maybeSubtotal = extractSubtotal(line);
      if (maybeSubtotal) {
        subtotal = maybeSubtotal;
        continue;
      }
    }

    if (!tax) {
      const maybeTax = extractTax(line);
      if (maybeTax) {
        tax = maybeTax;
        continue;
      }
    }

    if (!total) {
      const maybeTotal = extractTotal(line);
      if (maybeTotal) {
        total = maybeTotal;
        continue;
      }
    }

    const itemMatch = extractItem(line);
    if (itemMatch) {
      itemNames.push(itemMatch.name);
      itemPrices.push(itemMatch.price);
    }
  }

  const results: ReceiptDataItem[] = [];
  let itemIndex = 0;
  const pushItem = (label: string, value: string) => {
    results.push({
      id: `${label.toLowerCase().replace(/\s+/g, '-')}-${itemIndex++}`,
      label,
      value
    });
  };

  if (vendor) {
    pushItem('Vendor', vendor);
  }

  if (itemNames.length > 0) {
    pushItem('Items', itemNames.join(' | '));
  }

  if (itemPrices.length > 0) {
    pushItem('Prices', itemPrices.join(' | '));
  }

  if (subtotal) {
    pushItem('Subtotal', subtotal);
  }

  if (tax) {
    pushItem('Tax', tax);
  }

  if (total) {
    pushItem('Total', total);
  }

  logDebug(`✅ [${passName}] Parsed ${results.length} items`);
  return results;
}

function isVendorLine(line: string): boolean {
  const vendorKeywords = ['store', 'shop', 'market', 'restaurant', 'cafe', 'bar', 'pharmacy', 'gas', 'station'];
  const lowerLine = line.toLowerCase();

  if (vendorKeywords.some((keyword) => lowerLine.includes(keyword))) {
    return true;
  }

  if (line.length > 5 && line.length < 50 && !/\d/.test(line)) {
    return true;
  }

  return false;
}

function normalizeAmount(amount: string): string {
  const cleaned = amount.replace(/[^0-9.\-]/g, '');
  if (!cleaned) {
    return amount.trim();
  }
  return cleaned;
}

function extractSubtotal(line: string): string | null {
  const match = line.match(/sub\s*total[^\d-]*(-?\d{1,4}[.,]\d{2})/i);
  if (match) {
    return normalizeAmount(match[1]);
  }
  return null;
}

function extractTax(line: string): string | null {
  const match = line.match(/(sales\s*)?tax[^\d-]*(-?\d{1,4}[.,]\d{2})/i);
  if (match) {
    return normalizeAmount(match[2] ?? match[1]);
  }
  return null;
}

function extractTotal(line: string): string | null {
  if (/sub\s*total/i.test(line)) {
    return null;
  }

  const match = line.match(/(grand\s*)?total(?:\s*(amount|due|balance|to\s*pay)?)?[^\d-]*(-?\d{1,5}[.,]\d{2})/i);
  if (match) {
    return normalizeAmount(match[3] ?? match[2]);
  }

  return null;
}

function extractItem(line: string): { name: string; price: string } | null {
  if (/(subtotal|total|tax|change|balance|due|tender|cash|visa|mastercard|amex|discover|phone|tel|zipcode|zip)/i.test(line)) {
    return null;
  }

  const itemPattern = /^(.+?)\s+\$?(-?\d{1,4}\.\d{2})(?:\s?[A-Za-z]{0,2})?$/;
  const match = line.match(itemPattern);

  if (match) {
    const name = match[1].trim();
    const priceString = normalizeAmount(match[2]);
    const numericPrice = parseFloat(priceString);

    if (
      /[a-zA-Z]/.test(name) &&
      name.length > 2 &&
      name.length < 60 &&
      Number.isFinite(numericPrice) &&
      numericPrice > 0 &&
      numericPrice <= 2000
    ) {
      return { name, price: numericPrice.toFixed(2) };
    }
  }

  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\t/g, '    ').replace(/\s{2,}/g, (match) => (match.length > 4 ? ' ' : match));
}

/**
 * Get OCR service information
 */
export function getTesseractOCRInfo() {
  return {
    name: 'Tesseract.js',
    version: '5.x',
    language: 'English',
    description: 'Google Tesseract OCR engine with multi-pass optimization',
    passes: OCR_PASS_CONFIGS.length,
    configurations: OCR_PASS_CONFIGS.map(c => ({
      name: c.name,
      description: c.description
    }))
  };
}
