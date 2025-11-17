/**
 * Tesseract OCR Service
 * =====================
 * 
 * Enhanced OCR service with multiple passes, tuned parameters, and intelligent result merging
 */

import Tesseract from 'tesseract.js';
import { ReceiptDataItem } from '@/types';
import { preprocessImageForOCR, getOptimalPreprocessingOptions, assessImageQuality } from './image-preprocessor';

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
    name: 'single_block_vert',
    psm: Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT,
    oem: Tesseract.OEM.LSTM_ONLY,
    description: 'Single block vertical - for vertical text layouts'
  },
  {
    name: 'sparse_text',
    psm: Tesseract.PSM.SPARSE_TEXT,
    oem: Tesseract.OEM.LSTM_ONLY,
    description: 'Sparse text - for receipts with scattered text'
  },
  {
    name: 'numeric_focused',
    psm: Tesseract.PSM.SINGLE_LINE,
    oem: Tesseract.OEM.LSTM_ONLY,
    whitelist: '0123456789.,$- ',
    description: 'Numeric-focused - optimized for prices and totals'
  },
  {
    name: 'auto_osd',
    psm: Tesseract.PSM.AUTO_OSD,
    oem: Tesseract.OEM.LSTM_ONLY,
    description: 'Auto with orientation and script detection'
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
    logger: () => {} // Silent logger - no progress messages
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
    const params: Record<string, string> = {
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
      tessedit_create_pdf: '0', // Disable PDF creation for speed
      // Better text recognition
      classify_bln_numeric_mode: '0',
      textord_min_linesize: '2.5',
      // Improve number recognition
      tessedit_matcher_avg_noise_size: '20',
      // Better handling of small text
      textord_min_size: '8',
      // Improve accuracy for receipts
      load_system_dawg: '1',
      load_freq_dawg: '1',
      load_punc_dawg: '1',
      load_number_dawg: '1',
      load_unambig_dawg: '1',
      load_bigram_dawg: '1',
      load_fixed_length_dawgs: '1'
    };
    
    await worker.setParameters(params as Record<string, string>);

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
 * Includes intelligent image preprocessing for maximum accuracy
 * @param imageDataUri - The image as a data URI
 * @returns Promise with OCR results
 */
export async function extractTextWithTesseract(imageDataUri: string): Promise<TesseractOCRResult> {
  const startTime = Date.now();
  const errorLog: string[] = [];

  try {
    logDebug('🔍 Starting enhanced multi-pass Tesseract OCR analysis...');

    // Step 1: Assess image quality
    let imageQuality;
    try {
      imageQuality = await assessImageQuality(imageDataUri);
      logDebug('📊 Image quality:', {
        blur: (imageQuality.blurScore * 100).toFixed(1) + '%',
        contrast: (imageQuality.contrastScore * 100).toFixed(1) + '%',
        brightness: (imageQuality.brightnessScore * 100).toFixed(1) + '%',
        resolution: (imageQuality.resolutionScore * 100).toFixed(1) + '%'
      });
    } catch (error) {
      logDebug('⚠️ Could not assess image quality, using default preprocessing');
    }

    // Step 2: Preprocess image for optimal OCR
    let preprocessedImage: string | null = null;
    try {
      const preprocessingOptions = imageQuality 
        ? await getOptimalPreprocessingOptions(imageDataUri)
        : {
            deskew: true,
            enhanceContrast: true,
            denoise: true,
            binarize: true,
            upscale: true,
            adaptiveThreshold: true,
            sharpen: true
          };
      
      logDebug('🖼️ Preprocessing image with options:', preprocessingOptions);
      preprocessedImage = await preprocessImageForOCR(imageDataUri, preprocessingOptions);
      logDebug('✅ Image preprocessing completed');
    } catch (error) {
      const errorMsg = `Image preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errorLog.push(errorMsg);
      logError(errorMsg, error);
      // Continue with original image if preprocessing fails
    }

    // Step 3: Run OCR passes on both original and preprocessed images
    // This gives us the best of both worlds - sometimes original works better
    const imagesToProcess = preprocessedImage 
      ? [imageDataUri, preprocessedImage] 
      : [imageDataUri];
    
    const allPassResults: OCRPassResult[] = [];

    for (const imageUri of imagesToProcess) {
      const imageType = imageUri === preprocessedImage ? 'preprocessed' : 'original';
      logDebug(`📸 Processing ${imageType} image...`);

      // Run all OCR passes in parallel for speed
      const passPromises = OCR_PASS_CONFIGS.map(config => 
        runOCRPass(imageUri, config).catch(error => {
          const errorMsg = `Pass "${config.name}" (${imageType}) failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errorLog.push(errorMsg);
          logError(errorMsg, error);
          return null;
        })
      );

      const passResults = await Promise.all(passPromises);
      const validResults = passResults.filter((r): r is OCRPassResult => r !== null);
      
      // Tag results with image type for better merging
      validResults.forEach(result => {
        allPassResults.push(result);
      });

      logDebug(`✅ Completed ${validResults.length}/${OCR_PASS_CONFIGS.length} OCR passes on ${imageType} image`);
    }

    if (allPassResults.length === 0) {
      throw new Error('All OCR passes failed');
    }

    logDebug(`✅ Completed ${allPassResults.length} total OCR passes`);

    // Step 4: Merge results from all passes (original + preprocessed)
    const mergedResult = mergeOCRResults(allPassResults);

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

/**
 * Comprehensive word lists for field detection
 */
const SUBTOTAL_KEYWORDS = [
  'subtotal', 'sub total', 'sub-total', 'sub_total',
  'subtotal:', 'sub total:', 'sub-total:', 'sub_total:',
  'subtotal amount', 'sub total amount', 'sub-total amount',
  'merchandise total', 'merchandise sub', 'merchandise subtotal',
  'items total', 'items sub', 'items subtotal',
  'goods total', 'goods sub', 'goods subtotal',
  'product total', 'product sub', 'product subtotal',
  'before tax', 'before taxes', 'pre-tax', 'pre tax',
  'amount before tax', 'amount before taxes',
  'sum', 'sum of items', 'item sum'
];

const TAX_KEYWORDS = [
  'tax', 'tax:', 'taxes', 'taxes:',
  'sales tax', 'sales tax:', 'sales taxes', 'sales taxes:',
  'tax amount', 'tax amount:', 'taxes amount', 'taxes amount:',
  'tax total', 'tax total:', 'taxes total', 'taxes total:',
  'tax due', 'tax due:', 'taxes due', 'taxes due:',
  'vat', 'vat:', 'value added tax', 'value added tax:',
  'gst', 'gst:', 'goods and services tax', 'goods and services tax:',
  'hst', 'hst:', 'harmonized sales tax', 'harmonized sales tax:',
  'state tax', 'state tax:', 'state taxes', 'state taxes:',
  'local tax', 'local tax:', 'local taxes', 'local taxes:',
  'city tax', 'city tax:', 'city taxes', 'city taxes:',
  'county tax', 'county tax:', 'county taxes', 'county taxes:',
  'tax rate', 'tax rate:', 'tax percentage', 'tax percentage:',
  'taxable', 'taxable amount', 'taxable amount:',
  'tax included', 'tax included:', 'taxes included', 'taxes included:',
  'tax excl', 'tax excl:', 'tax excluded', 'tax excluded:',
  'tx', 'tx:', 'txs', 'txs:'
];

const TOTAL_KEYWORDS = [
  'total', 'total:', 'totals', 'totals:',
  'grand total', 'grand total:', 'grand totals', 'grand totals:',
  'total amount', 'total amount:', 'total amounts', 'total amounts:',
  'total due', 'total due:', 'total dues', 'total dues:',
  'total to pay', 'total to pay:', 'total to be paid', 'total to be paid:',
  'amount due', 'amount due:', 'amount to pay', 'amount to pay:',
  'balance', 'balance:', 'balance due', 'balance due:',
  'final total', 'final total:', 'final amount', 'final amount:',
  'final due', 'final due:', 'final balance', 'final balance:',
  'payable', 'payable:', 'amount payable', 'amount payable:',
  'owed', 'owed:', 'amount owed', 'amount owed:',
  'charge', 'charge:', 'total charge', 'total charge:',
  'sum total', 'sum total:', 'sum of all', 'sum of all:',
  'overall total', 'overall total:', 'overall amount', 'overall amount:',
  'complete total', 'complete total:', 'complete amount', 'complete amount:',
  'full total', 'full total:', 'full amount', 'full amount:',
  'net total', 'net total:', 'net amount', 'net amount:',
  'after tax', 'after taxes', 'after-tax', 'after tax total',
  'including tax', 'including taxes', 'incl tax', 'incl taxes',
  'ttl', 'ttl:', 'tot', 'tot:'
];

function normalizeAmount(amount: string): string {
  const cleaned = amount.replace(/[^0-9.\-]/g, '');
  if (!cleaned) {
    return amount.trim();
  }
  return cleaned;
}

/**
 * Check if a line contains any of the given keywords (case-insensitive)
 */
function containsKeyword(line: string, keywords: string[]): boolean {
  const lowerLine = line.toLowerCase();
  return keywords.some(keyword => lowerLine.includes(keyword.toLowerCase()));
}

/**
 * Extract subtotal from a line using comprehensive keyword matching
 */
function extractSubtotal(line: string): string | null {
  // First check if line contains subtotal keywords
  if (!containsKeyword(line, SUBTOTAL_KEYWORDS)) {
    return null;
  }

  // Try various patterns to extract the amount
  const patterns = [
    // Pattern: "subtotal: $12.34" or "sub total 12.34"
    /(?:sub\s*[-_]?total|before\s*tax|pre\s*[-_]?tax)[:.\s]*\$?\s*(-?\d{1,4}[.,]\d{2})/i,
    // Pattern: "$12.34 subtotal"
    /\$?\s*(-?\d{1,4}[.,]\d{2})\s*(?:sub\s*[-_]?total|before\s*tax|pre\s*[-_]?tax)/i,
    // Pattern: "subtotal 12.34" (no currency symbol)
    /(?:sub\s*[-_]?total|before\s*tax|pre\s*[-_]?tax)[:.\s]+(-?\d{1,4}[.,]\d{2})/i,
    // Pattern: amount at end of line after subtotal keyword
    /(?:sub\s*[-_]?total|before\s*tax|pre\s*[-_]?tax).*?(-?\d{1,4}[.,]\d{2})\s*$/i
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const amount = normalizeAmount(match[1]);
      if (amount) {
        return amount;
      }
    }
  }

  return null;
}

/**
 * Extract tax from a line using comprehensive keyword matching
 */
function extractTax(line: string): string | null {
  // First check if line contains tax keywords
  if (!containsKeyword(line, TAX_KEYWORDS)) {
    return null;
  }

  // Exclude lines that are clearly not tax (e.g., "tax exempt", "no tax")
  if (/(?:tax\s*exempt|no\s*tax|tax\s*free|zero\s*tax|0\s*tax)/i.test(line)) {
    return null;
  }

  // Try various patterns to extract the amount
  const patterns = [
    // Pattern: "tax: $1.23" or "sales tax 1.23"
    /(?:sales\s*)?tax(?:es)?[:.\s]*\$?\s*(-?\d{1,4}[.,]\d{2})/i,
    // Pattern: "$1.23 tax"
    /\$?\s*(-?\d{1,4}[.,]\d{2})\s*(?:sales\s*)?tax(?:es)?/i,
    // Pattern: "tax 1.23" (no currency symbol)
    /(?:sales\s*)?tax(?:es)?[:.\s]+(-?\d{1,4}[.,]\d{2})/i,
    // Pattern: VAT/GST/HST variations
    /(?:vat|gst|hst)[:.\s]*\$?\s*(-?\d{1,4}[.,]\d{2})/i,
    // Pattern: amount at end of line after tax keyword
    /(?:sales\s*)?tax(?:es)?.*?(-?\d{1,4}[.,]\d{2})\s*$/i
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const amount = normalizeAmount(match[1]);
      if (amount) {
        return amount;
      }
    }
  }

  return null;
}

/**
 * Extract total from a line using comprehensive keyword matching
 */
function extractTotal(line: string): string | null {
  // Exclude subtotal lines
  if (containsKeyword(line, SUBTOTAL_KEYWORDS)) {
    return null;
  }

  // First check if line contains total keywords
  if (!containsKeyword(line, TOTAL_KEYWORDS)) {
    return null;
  }

  // Try various patterns to extract the amount
  const patterns = [
    // Pattern: "total: $12.34" or "grand total 12.34"
    /(?:grand\s*)?total(?:\s*(?:amount|due|balance|to\s*pay|charge))?[:.\s]*\$?\s*(-?\d{1,5}[.,]\d{2})/i,
    // Pattern: "$12.34 total"
    /\$?\s*(-?\d{1,5}[.,]\d{2})\s*(?:grand\s*)?total/i,
    // Pattern: "total 12.34" (no currency symbol)
    /(?:grand\s*)?total[:.\s]+(-?\d{1,5}[.,]\d{2})/i,
    // Pattern: "amount due: $12.34"
    /(?:amount\s*(?:due|to\s*pay|payable|owed)|balance\s*(?:due)?)[:.\s]*\$?\s*(-?\d{1,5}[.,]\d{2})/i,
    // Pattern: amount at end of line after total keyword
    /(?:grand\s*)?total.*?(-?\d{1,5}[.,]\d{2})\s*$/i,
    // Pattern: "final total", "complete total", etc.
    /(?:final|complete|overall|full|net)\s*(?:total|amount)[:.\s]*\$?\s*(-?\d{1,5}[.,]\d{2})/i
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const amount = normalizeAmount(match[1]);
      if (amount) {
        return amount;
      }
    }
  }

  return null;
}

function extractItem(line: string): { name: string; price: string } | null {
  // Exclude lines that contain subtotal, tax, or total keywords
  if (containsKeyword(line, SUBTOTAL_KEYWORDS) || 
      containsKeyword(line, TAX_KEYWORDS) || 
      containsKeyword(line, TOTAL_KEYWORDS)) {
    return null;
  }
  
  // Exclude other common non-item lines
  if (/(change|balance|due|tender|cash|visa|mastercard|amex|discover|phone|tel|zipcode|zip|payment|method|card|refund|return)/i.test(line)) {
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
