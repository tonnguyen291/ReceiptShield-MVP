/**
 * Image Preprocessing for OCR
 * ===========================
 * 
 * Comprehensive image preprocessing to improve OCR accuracy for receipts
 * Handles: deskewing, contrast enhancement, noise reduction, binarization, upscaling
 */

const isDebugLoggingEnabled = process.env.NODE_ENV !== 'production';

const logDebug = (...args: unknown[]) => {
  if (!isDebugLoggingEnabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[Image Preprocessor]', ...args);
};

const logError = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.error('[Image Preprocessor]', ...args);
};

export interface PreprocessingOptions {
  deskew?: boolean;
  enhanceContrast?: boolean;
  denoise?: boolean;
  binarize?: boolean;
  upscale?: boolean;
  adaptiveThreshold?: boolean;
  sharpen?: boolean;
}

export interface ImageQualityMetrics {
  blurScore: number; // 0-1, higher = sharper
  contrastScore: number; // 0-1, higher = more contrast
  brightnessScore: number; // 0-1, optimal around 0.5
  resolutionScore: number; // 0-1, based on dimensions
}

/**
 * Preprocess image for optimal OCR accuracy
 * Uses Canvas API for client-side processing
 */
export async function preprocessImageForOCR(
  imageDataUri: string,
  options: PreprocessingOptions = {}
): Promise<string> {
  const startTime = Date.now();
  const {
    deskew = true,
    enhanceContrast = true,
    denoise = true,
    binarize = true,
    upscale = true,
    adaptiveThreshold = true,
    sharpen = true
  } = options;

  logDebug('🖼️ Starting image preprocessing...');
  logDebug('📋 Options:', {
    deskew,
    enhanceContrast,
    denoise,
    binarize,
    upscale,
    adaptiveThreshold,
    sharpen
  });

  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = async () => {
        try {
          logDebug(`📐 Original image dimensions: ${img.width}x${img.height}`);
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Determine optimal dimensions (upscale if needed)
          let width = img.width;
          let height = img.height;
          const minDimension = 1200; // Minimum dimension for good OCR
          
          if (upscale && (width < minDimension || height < minDimension)) {
            const scale = Math.max(minDimension / width, minDimension / height);
            const oldWidth = width;
            const oldHeight = height;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            logDebug(`⬆️ Upscaling: ${oldWidth}x${oldHeight} → ${width}x${height} (scale: ${scale.toFixed(2)}x)`);
          } else if (upscale) {
            logDebug(`✓ Image resolution already sufficient: ${width}x${height}`);
          }

          canvas.width = width;
          canvas.height = height;

          // Draw original image
          logDebug('🎨 Drawing original image to canvas...');
          ctx.drawImage(img, 0, 0, width, height);

          // Get image data
          logDebug('📊 Extracting image data...');
          let imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          logDebug(`✓ Image data extracted: ${data.length / 4} pixels`);

          // Step 1: Convert to grayscale (always do this first)
          logDebug('🔘 Step 1/6: Converting to grayscale...');
          const grayscaleStart = Date.now();
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Use luminance formula for better grayscale conversion
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
          }
          logDebug(`✓ Grayscale conversion completed in ${Date.now() - grayscaleStart}ms`);

          // Step 2: Deskew (rotate to correct orientation)
          if (deskew) {
            logDebug('🔄 Step 2/6: Detecting and correcting skew...');
            const deskewStart = Date.now();
            imageData = await deskewImage(imageData, ctx);
            logDebug(`✓ Deskew completed in ${Date.now() - deskewStart}ms`);
          } else {
            logDebug('⏭️ Skipping deskew (disabled)');
          }

          // Step 3: Enhance contrast
          if (enhanceContrast) {
            logDebug('📈 Step 3/6: Enhancing contrast (histogram equalization)...');
            const contrastStart = Date.now();
            enhanceContrastImage(imageData.data);
            logDebug(`✓ Contrast enhancement completed in ${Date.now() - contrastStart}ms`);
          } else {
            logDebug('⏭️ Skipping contrast enhancement (disabled)');
          }

          // Step 4: Denoise (reduce noise)
          if (denoise) {
            logDebug('🔇 Step 4/6: Denoising (median filter)...');
            const denoiseStart = Date.now();
            imageData = denoiseImage(imageData, ctx);
            logDebug(`✓ Denoising completed in ${Date.now() - denoiseStart}ms`);
          } else {
            logDebug('⏭️ Skipping denoising (disabled)');
          }

          // Step 5: Sharpen
          if (sharpen) {
            logDebug('✨ Step 5/6: Sharpening image...');
            const sharpenStart = Date.now();
            imageData = sharpenImage(imageData, ctx);
            logDebug(`✓ Sharpening completed in ${Date.now() - sharpenStart}ms`);
          } else {
            logDebug('⏭️ Skipping sharpening (disabled)');
          }

          // Step 6: Binarize (convert to black and white)
          if (binarize) {
            if (adaptiveThreshold) {
              logDebug('⚫ Step 6/6: Binarizing (adaptive threshold)...');
              const binarizeStart = Date.now();
              imageData = adaptiveThresholdImage(imageData, ctx);
              logDebug(`✓ Adaptive threshold binarization completed in ${Date.now() - binarizeStart}ms`);
            } else {
              logDebug('⚫ Step 6/6: Binarizing (Otsu threshold)...');
              const binarizeStart = Date.now();
              binarizeImage(imageData.data);
              logDebug(`✓ Otsu threshold binarization completed in ${Date.now() - binarizeStart}ms`);
            }
          } else {
            logDebug('⏭️ Skipping binarization (disabled)');
          }

          // Put processed image data back
          logDebug('💾 Writing processed image data to canvas...');
          ctx.putImageData(imageData, 0, 0);

          // Convert to data URI
          logDebug('🔄 Converting canvas to data URI...');
          const processedDataUri = canvas.toDataURL('image/png', 1.0);
          const totalTime = Date.now() - startTime;
          logDebug(`✅ Image preprocessing completed in ${totalTime}ms`);
          logDebug(`📦 Output size: ${(processedDataUri.length / 1024).toFixed(2)} KB`);
          resolve(processedDataUri);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logError('❌ Error during preprocessing:', errorMsg, error);
          reject(error);
        }
      };

      img.onerror = () => {
        logError('❌ Failed to load image from data URI');
        reject(new Error('Failed to load image'));
      };

      img.src = imageDataUri;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Detect and correct image skew using Hough transform approximation
 */
async function deskewImage(
  imageData: ImageData,
  ctx: CanvasRenderingContext2D
): Promise<ImageData> {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  logDebug('  🔍 Analyzing image for skew angle...');
  
  // Simple skew detection: find dominant text line angle
  // This is a simplified version - full Hough transform would be more accurate
  let bestAngle = 0;
  let maxVotes = 0;

  // Sample angles from -15 to +15 degrees
  const anglesToTest = [];
  for (let angle = -15; angle <= 15; angle += 0.5) {
    anglesToTest.push(angle);
  }
  
  logDebug(`  📐 Testing ${anglesToTest.length} angles from -15° to +15°...`);
  
  for (const angle of anglesToTest) {
    let votes = 0;
    
    // Sample horizontal lines to detect skew
    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 10) {
      let transitions = 0;
      let lastValue = 0;
      
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = data[idx];
        const threshold = 128;
        
        if ((gray < threshold && lastValue >= threshold) || 
            (gray >= threshold && lastValue < threshold)) {
          transitions++;
        }
        lastValue = gray;
      }
      
      // More transitions = more text = better alignment
      if (transitions > 5) {
        votes += transitions;
      }
    }
    
    if (votes > maxVotes) {
      maxVotes = votes;
      bestAngle = angle;
    }
  }

  logDebug(`  📊 Best angle detected: ${bestAngle.toFixed(2)}° (confidence: ${maxVotes} votes)`);

  // If significant skew detected, rotate image
  if (Math.abs(bestAngle) > 0.5) {
    logDebug(`  🔄 Rotating image by ${bestAngle.toFixed(2)}° to correct skew...`);
    const canvas = document.createElement('canvas');
    const tempCtx = canvas.getContext('2d');
    if (!tempCtx) {
      logDebug('  ⚠️ Could not create rotation canvas, skipping rotation');
      return imageData;
    }

    canvas.width = width;
    canvas.height = height;

    tempCtx.translate(width / 2, height / 2);
    tempCtx.rotate((bestAngle * Math.PI) / 180);
    tempCtx.translate(-width / 2, -height / 2);
    tempCtx.putImageData(imageData, 0, 0);

    // Get rotated image data
    const rotatedData = tempCtx.getImageData(0, 0, width, height);
    logDebug(`  ✓ Image rotated successfully`);
    return rotatedData;
  }

  logDebug('  ✓ No significant skew detected, image is already aligned');
  return imageData;
}

/**
 * Enhance contrast using histogram equalization
 */
function enhanceContrastImage(data: Uint8ClampedArray): void {
  // Calculate histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  // Calculate cumulative distribution
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // Normalize CDF
  const cdfMin = cdf.find(v => v > 0) || 0;
  const pixels = data.length / 4;
  const cdfRange = cdf[255] - cdfMin;

  // Apply histogram equalization
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    if (cdfRange > 0) {
      const normalized = ((cdf[gray] - cdfMin) / cdfRange) * 255;
      const enhanced = Math.round(normalized);
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
  }
}

/**
 * Denoise image using median filter
 */
function denoiseImage(
  imageData: ImageData,
  ctx: CanvasRenderingContext2D
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new ImageData(width, height);
  const outputData = output.data;

  // 3x3 median filter
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const values: number[] = [];
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          values.push(data[idx]);
        }
      }
      
      // Get median
      values.sort((a, b) => a - b);
      const median = values[4]; // Middle value of 9
      
      const idx = (y * width + x) * 4;
      outputData[idx] = median;
      outputData[idx + 1] = median;
      outputData[idx + 2] = median;
      outputData[idx + 3] = data[idx + 3]; // Preserve alpha
    }
  }

  // Copy edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        const idx = (y * width + x) * 4;
        outputData[idx] = data[idx];
        outputData[idx + 1] = data[idx + 1];
        outputData[idx + 2] = data[idx + 2];
        outputData[idx + 3] = data[idx + 3];
      }
    }
  }

  return output;
}

/**
 * Sharpen image using unsharp mask
 */
function sharpenImage(
  imageData: ImageData,
  ctx: CanvasRenderingContext2D
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new ImageData(width, height);
  const outputData = output.data;

  // Unsharp mask kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          sum += data[idx] * kernel[kernelIdx];
        }
      }
      
      const idx = (y * width + x) * 4;
      const sharpened = Math.max(0, Math.min(255, sum));
      outputData[idx] = sharpened;
      outputData[idx + 1] = sharpened;
      outputData[idx + 2] = sharpened;
      outputData[idx + 3] = data[idx + 3];
    }
  }

  // Copy edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        const idx = (y * width + x) * 4;
        outputData[idx] = data[idx];
        outputData[idx + 1] = data[idx + 1];
        outputData[idx + 2] = data[idx + 2];
        outputData[idx + 3] = data[idx + 3];
      }
    }
  }

  return output;
}

/**
 * Adaptive threshold binarization (better than global threshold)
 */
function adaptiveThresholdImage(
  imageData: ImageData,
  ctx: CanvasRenderingContext2D
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new ImageData(width, height);
  const outputData = output.data;

  const blockSize = 15; // Size of local region
  const C = 10; // Constant subtracted from mean

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calculate local mean
      let sum = 0;
      let count = 0;
      
      const yStart = Math.max(0, y - Math.floor(blockSize / 2));
      const yEnd = Math.min(height, y + Math.floor(blockSize / 2));
      const xStart = Math.max(0, x - Math.floor(blockSize / 2));
      const xEnd = Math.min(width, x + Math.floor(blockSize / 2));
      
      for (let ly = yStart; ly < yEnd; ly++) {
        for (let lx = xStart; lx < xEnd; lx++) {
          const idx = (ly * width + lx) * 4;
          sum += data[idx];
          count++;
        }
      }
      
      const mean = sum / count;
      const idx = (y * width + x) * 4;
      const gray = data[idx];
      
      // Threshold: if pixel > (mean - C), make it white, else black
      const threshold = mean - C;
      const binary = gray > threshold ? 255 : 0;
      
      outputData[idx] = binary;
      outputData[idx + 1] = binary;
      outputData[idx + 2] = binary;
      outputData[idx + 3] = data[idx + 3];
    }
  }

  return output;
}

/**
 * Simple global threshold binarization
 */
function binarizeImage(data: Uint8ClampedArray): void {
  // Calculate optimal threshold using Otsu's method
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  const pixels = data.length / 4;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    
    wF = pixels - wB;
    if (wF === 0) break;
    
    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  // Apply threshold
  for (let i = 0; i < data.length; i += 4) {
    const binary = data[i] > threshold ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
}

/**
 * Assess image quality metrics
 */
export async function assessImageQuality(imageDataUri: string): Promise<ImageQualityMetrics> {
  logDebug('📊 Assessing image quality...');
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        logDebug(`  📐 Image dimensions: ${img.width}x${img.height}`);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        
        logDebug('  🔍 Calculating blur score (Laplacian variance)...');

        // Calculate blur score (Laplacian variance)
        let laplacianSum = 0;
        let laplacianSumSq = 0;
        const width = img.width;
        const height = img.height;

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            const center = data[idx];
            const top = data[((y - 1) * width + x) * 4];
            const bottom = data[((y + 1) * width + x) * 4];
            const left = data[(y * width + (x - 1)) * 4];
            const right = data[(y * width + (x + 1)) * 4];

            const laplacian = Math.abs(4 * center - top - bottom - left - right);
            laplacianSum += laplacian;
            laplacianSumSq += laplacian * laplacian;
          }
        }

        const n = (width - 2) * (height - 2);
        const mean = laplacianSum / n;
        const variance = (laplacianSumSq / n) - (mean * mean);
        const blurScore = Math.min(1, variance / 1000); // Normalize to 0-1
        logDebug(`  ✓ Blur score: ${(blurScore * 100).toFixed(1)}% (variance: ${variance.toFixed(2)})`);

        // Calculate contrast score (standard deviation of grayscale values)
        logDebug('  🔍 Calculating contrast score...');
        let graySum = 0;
        let graySumSq = 0;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          graySum += gray;
          graySumSq += gray * gray;
        }
        const grayMean = graySum / (data.length / 4);
        const grayStdDev = Math.sqrt((graySumSq / (data.length / 4)) - (grayMean * grayMean));
        const contrastScore = Math.min(1, grayStdDev / 128); // Normalize to 0-1
        logDebug(`  ✓ Contrast score: ${(contrastScore * 100).toFixed(1)}% (std dev: ${grayStdDev.toFixed(2)})`);

        // Calculate brightness score
        const brightnessScore = grayMean / 255;
        logDebug(`  ✓ Brightness score: ${(brightnessScore * 100).toFixed(1)}% (mean: ${grayMean.toFixed(2)})`);

        // Calculate resolution score
        const minDimension = Math.min(width, height);
        const resolutionScore = Math.min(1, minDimension / 1200);
        logDebug(`  ✓ Resolution score: ${(resolutionScore * 100).toFixed(1)}% (min dimension: ${minDimension}px)`);

        const totalTime = Date.now() - startTime;
        logDebug(`✅ Quality assessment completed in ${totalTime}ms`);
        logDebug('📊 Quality Summary:', {
          blur: `${(blurScore * 100).toFixed(1)}%`,
          contrast: `${(contrastScore * 100).toFixed(1)}%`,
          brightness: `${(brightnessScore * 100).toFixed(1)}%`,
          resolution: `${(resolutionScore * 100).toFixed(1)}%`
        });

        resolve({
          blurScore,
          contrastScore,
          brightnessScore,
          resolutionScore
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logError('❌ Error during quality assessment:', errorMsg, error);
        reject(error);
      }
    };

    img.onerror = () => {
      logError('❌ Failed to load image for quality assessment');
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUri;
  });
}

/**
 * Get optimal preprocessing options based on image quality
 */
export async function getOptimalPreprocessingOptions(
  imageDataUri: string
): Promise<PreprocessingOptions> {
  logDebug('🎯 Determining optimal preprocessing options based on image quality...');
  const quality = await assessImageQuality(imageDataUri);

  const options: PreprocessingOptions = {
    deskew: true, // Always deskew
    enhanceContrast: quality.contrastScore < 0.5,
    denoise: quality.blurScore < 0.3 || quality.resolutionScore < 0.7,
    binarize: true, // Always binarize for receipts
    upscale: quality.resolutionScore < 0.8,
    adaptiveThreshold: true, // Always use adaptive for better results
    sharpen: quality.blurScore < 0.4
  };

  logDebug('🔧 Optimal preprocessing options determined:');
  logDebug(`  • Deskew: ${options.deskew ? '✓ Enabled' : '✗ Disabled'} (always enabled)`);
  logDebug(`  • Enhance Contrast: ${options.enhanceContrast ? '✓ Enabled' : '✗ Disabled'} (contrast: ${(quality.contrastScore * 100).toFixed(1)}%)`);
  logDebug(`  • Denoise: ${options.denoise ? '✓ Enabled' : '✗ Disabled'} (blur: ${(quality.blurScore * 100).toFixed(1)}%, resolution: ${(quality.resolutionScore * 100).toFixed(1)}%)`);
  logDebug(`  • Binarize: ${options.binarize ? '✓ Enabled' : '✗ Disabled'} (always enabled)`);
  logDebug(`  • Upscale: ${options.upscale ? '✓ Enabled' : '✗ Disabled'} (resolution: ${(quality.resolutionScore * 100).toFixed(1)}%)`);
  logDebug(`  • Adaptive Threshold: ${options.adaptiveThreshold ? '✓ Enabled' : '✗ Disabled'} (always enabled)`);
  logDebug(`  • Sharpen: ${options.sharpen ? '✓ Enabled' : '✗ Disabled'} (blur: ${(quality.blurScore * 100).toFixed(1)}%)`);

  return options;
}

