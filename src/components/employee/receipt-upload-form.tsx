'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { uploadReceiptImage, fileToDataUri, testStorageConnectivity } from '@/lib/firebase-storage';
import { addReceipt } from '@/lib/firebase-receipt-store';
import { performEnhancedOCRAnalysis } from '@/lib/enhanced-ocr-service';
import { extractTextWithTesseract, type OCRConfidenceBreakdown } from '@/lib/tesseract-ocr-service';
import { canUploadReceipt, recordReceiptUpload } from '@/lib/subscription-middleware';
// import { performEnhancedFraudAnalysis } from '@/lib/enhanced-fraud-service'; // Temporarily disabled
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileImage, CheckCircle, AlertCircle, Loader2, X, ArrowUpCircle } from 'lucide-react';
import type { ProcessedReceipt, ReceiptDataItem } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Debug build tag to verify deployment contents in Chrome DevTools
const RECEIPT_UPLOAD_FORM_BUILD_TAG = 'RUF-DEBUG-2025-10-29T00:00Z';
if (typeof window !== 'undefined') {
  console.info(`[ReceiptUploadForm] Loaded build tag: ${RECEIPT_UPLOAD_FORM_BUILD_TAG}`);
}

interface UploadStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number;
}

export default function ReceiptUploadForm() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    console.info('[ReceiptUploadForm] Rendered with build tag:', RECEIPT_UPLOAD_FORM_BUILD_TAG);
  }, []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<ReceiptDataItem[]>([]);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [ocrConfidenceBreakdown, setOcrConfidenceBreakdown] = useState<OCRConfidenceBreakdown | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [usageInfo, setUsageInfo] = useState<{ current: number; limit: number; reason?: string } | null>(null);
  const [uploadSteps, setUploadSteps] = useState<UploadStep[]>([
    { id: 'upload', label: 'Uploading image', status: 'pending', progress: 0 },
    { id: 'ocr', label: 'Extracting text', status: 'pending', progress: 0 },
    { id: 'fraud', label: 'Analyzing for fraud', status: 'pending', progress: 0 },
    { id: 'save', label: 'Saving receipt', status: 'pending', progress: 0 },
  ]);

  const acceptedFileTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (!acceptedFileTypes.includes(file.type)) {
      return 'Please select a valid image file (JPG, PNG, or WebP)';
    }
    if (file.size > maxFileSize) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setExtractedItems([]); // Clear previous extracted items
    setOcrConfidence(null);
    setOcrConfidenceBreakdown(null);
    
    try {
      const dataUri = await fileToDataUri(file);
      setImagePreview(dataUri);
      
      // Automatically start OCR processing
      await performOCRProcessing(dataUri);
    } catch (err) {
      setError('Failed to preview image');
    }
  }, []);

  const performOCRProcessing = async (imageDataUri: string) => {
    setIsOcrProcessing(true);
    setOcrProgress(0);
    setOcrConfidence(null);
    setOcrConfidenceBreakdown(null);
    
    try {
      console.log('🔍 Starting automatic OCR processing...');
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setOcrProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      const ocrResult = await extractTextWithTesseract(imageDataUri);
      
      clearInterval(progressInterval);
      setOcrProgress(100);

      // Update extracted items and confidence
      setExtractedItems(ocrResult.items);
      setOcrConfidence(ocrResult.confidence);
      setOcrConfidenceBreakdown(ocrResult.confidenceBreakdown || null);
      
      console.log('✅ OCR completed:', {
        itemsCount: ocrResult.items.length,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        confidenceBreakdown: ocrResult.confidenceBreakdown
      });

    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      setError('OCR processing failed. You can still proceed with manual entry.');
      setOcrConfidence(null);
      setOcrConfidenceBreakdown(null);
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const updateStep = (stepId: string, status: UploadStep['status'], progress: number = 0) => {
    setUploadSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, progress }
        : step
    ));
  };

  const processReceipt = async () => {
    if (!selectedFile || !user) return;

    // Check subscription limits before proceeding
    if (user.companyId) {
      const usageCheck = await canUploadReceipt(user.companyId);
      
      if (!usageCheck.allowed) {
        setUsageInfo({
          current: usageCheck.currentUsage?.receipts || 0,
          limit: usageCheck.limits?.maxReceipts || 0,
          reason: usageCheck.reason,
        });
        setShowUpgradeDialog(true);
        return;
      }
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Generate unique receipt ID
      const receiptId = `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Test Firebase Storage connectivity first
      console.log('Testing Firebase Storage connectivity...');
      const isStorageConnected = await testStorageConnectivity();
      if (!isStorageConnected) {
        throw new Error('Firebase Storage is not accessible. Please check your internet connection and Firebase configuration.');
      }
      
      // Step 1: Upload image
      updateStep('upload', 'in_progress', 0);
      console.log('Starting upload with user:', { 
        userId: user.id, 
        userUid: user.uid,
        email: user.email 
      });
      
      // Use user.uid instead of user.id for Firebase Auth compatibility
      const uploadResult = await uploadReceiptImage(selectedFile, user.uid, receiptId);
      updateStep('upload', 'completed', 100);
      setUploadProgress(25);

      // Step 2: OCR Analysis (use pre-extracted items if available)
      updateStep('ocr', 'in_progress', 0);
      let ocrResult;
      
      if (extractedItems.length > 0) {
        // Use pre-extracted items from Tesseract OCR
        ocrResult = {
          extractedItems: extractedItems,
          rawOcrText: 'Extracted via Tesseract OCR',
          ocrConfidence: 0.8 // Default confidence for Tesseract
        };
        console.log('✅ Using pre-extracted OCR items:', extractedItems.length);
      } else {
        // Fallback to enhanced OCR service
        ocrResult = await performEnhancedOCRAnalysis(uploadResult.url, undefined, receiptId);
      }
      
      updateStep('ocr', 'completed', 100);
      setUploadProgress(50);

      // Step 3: Fraud Detection with ML prediction and AI analysis
      updateStep('fraud', 'in_progress', 0);
      
      // Prepare receipt data for analysis
      const receiptDataForAnalysis = {
        amount: ocrResult.extractedItems?.find(item => 
          item.label.toLowerCase().includes('total') || 
          item.label.toLowerCase().includes('amount')
        )?.value || '0',
        merchant: ocrResult.extractedItems?.find(item => 
          item.label.toLowerCase().includes('vendor') || 
          item.label.toLowerCase().includes('store')
        )?.value || 'Unknown',
        date: ocrResult.extractedItems?.find(item => 
          item.label.toLowerCase().includes('date')
        )?.value || new Date().toISOString(),
        category: 'Business Expense', // Default category
      };

      // Get ML prediction (parallel with AI analysis)
      let mlPrediction: any = null;
      const mlPromise = (async () => {
        try {
          console.log('🤖 Calling ML prediction API...');
          
          const mlResponse = await fetch('/api/ml-predict', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              items: ocrResult.extractedItems || [],
              ...receiptDataForAnalysis
            })
          });

          if (mlResponse.ok) {
            const mlData = await mlResponse.json();
            mlPrediction = mlData.prediction;
            console.log('✅ ML prediction received:', mlPrediction);
          } else {
            console.warn('⚠️ ML prediction failed:', mlResponse.status);
          }
        } catch (mlError) {
          console.warn('⚠️ ML prediction error:', mlError);
        }
      })();

      // Get AI analysis using Google Gemini (parallel with ML)
      let aiDetection: any = null;
      const aiPromise = (async () => {
        try {
          console.log('🤖 Calling AI fraud analysis API...');
          
          // Add timeout to prevent hanging on 502 errors
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          try {
            const aiResponse = await fetch('/api/ai-fraud-analysis', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                items: ocrResult.extractedItems || [],
                imageUrl: uploadResult.url,
                receiptData: receiptDataForAnalysis
              }),
              signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              aiDetection = {
                fraudulent: aiData.fraudulent || false,
                fraudProbability: aiData.fraudProbability || 0.1,
                explanation: aiData.explanation || 'AI analysis completed. No fraud indicators detected.',
                riskFactors: aiData.riskFactors || [],
                confidence: aiData.confidence || 0.7
              };
              console.log('✅ AI analysis received:', aiDetection);
            } else {
              console.warn('⚠️ AI analysis failed:', aiResponse.status);
              // Fallback if AI analysis fails
              aiDetection = {
                fraudulent: false,
                fraudProbability: 0.1,
                explanation: 'AI analysis was not available at the time of processing. Receipt will be reviewed manually.',
                riskFactors: [],
                confidence: 0.3
              };
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            // Handle network errors, timeouts, and 502 errors
            if (fetchError.name === 'AbortError') {
              console.warn('⚠️ AI analysis timed out after 30 seconds');
            } else {
              console.warn('⚠️ AI analysis network error:', fetchError);
            }
            // Fallback if AI analysis fails
            aiDetection = {
              fraudulent: false,
              fraudProbability: 0.1,
              explanation: 'AI analysis was not available at the time of processing. Receipt will be reviewed manually.',
              riskFactors: [],
              confidence: 0.3
            };
          }
        } catch (aiError) {
          console.warn('⚠️ AI analysis error:', aiError);
          // Fallback if AI analysis fails
          aiDetection = {
            fraudulent: false,
            fraudProbability: 0.1,
            explanation: 'AI analysis encountered an error. Receipt will be reviewed manually.',
            riskFactors: [],
            confidence: 0.3
          };
        }
      })();

      // Wait for both analyses to complete (use allSettled to continue even if one fails)
      await Promise.allSettled([mlPromise, aiPromise]);

      // Determine overall fraud status based on both ML and AI analysis
      const mlSaysFraud = mlPrediction?.is_fraudulent || false;
      const aiSaysFraud = aiDetection?.fraudulent || false;
      const isActuallyFraudulent = mlSaysFraud || aiSaysFraud;
      
      // Calculate combined fraud probability (weighted average)
      const mlWeight = 0.6;
      const aiWeight = 0.4;
      const combinedFraudProbability = (
        (mlPrediction?.fraud_probability || 0.1) * mlWeight +
        (aiDetection?.fraudProbability || 0.1) * aiWeight
      );

      // Determine overall risk level
      let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (combinedFraudProbability >= 0.7) {
        overallRisk = 'HIGH';
      } else if (combinedFraudProbability >= 0.4) {
        overallRisk = 'MEDIUM';
      }

      // Combine explanations
      let explanation = '';
      if (mlPrediction) {
        explanation += `ML Analysis: ${mlPrediction.risk_level} risk (${(mlPrediction.fraud_probability * 100).toFixed(1)}% fraud probability). `;
      }
      if (aiDetection && aiDetection.explanation) {
        explanation += `AI Analysis: ${aiDetection.explanation}`;
      }
      if (!explanation) {
        explanation = 'Receipt processed successfully. No fraud detected.';
      }

      const fraudResult = {
        isFraudulent: isActuallyFraudulent,
        fraudProbability: combinedFraudProbability,
        explanation: explanation.trim(),
        riskFactors: {
          imageQuality: 'good' as const,
          extractionConfidence: 'high' as const,
          vendorVerification: 'unknown' as const,
          amountReasonableness: 'normal' as const,
        },
        duplicateDetection: {
          isDuplicate: false,
          similarSubmissions: [],
          similarityScore: 0,
        },
        analysis: {
          submissionId: receiptId,
          receiptId: receiptId,
          ml_prediction: mlPrediction,
          ai_detection: aiDetection,
          overall_risk_assessment: overallRisk,
          analysis_timestamp: new Date().toISOString(),
          duplicateDetection: {
            isDuplicate: false,
            similarSubmissions: [],
            similarityScore: 0,
          },
          riskFactors: {
            imageQuality: 'good' as const,
            extractionConfidence: 'high' as const,
            vendorVerification: 'unknown' as const,
            amountReasonableness: 'normal' as const,
          },
        }
      };
      
      updateStep('fraud', 'completed', 100);
      setUploadProgress(75);

      // Step 4: Save receipt data
      updateStep('save', 'in_progress', 0);
      
      // Log AI detection before saving
      console.log('💾 Preparing receipt data for save:', {
        hasAiDetection: !!aiDetection,
        aiDetection: aiDetection,
        hasMlPrediction: !!mlPrediction,
        overallRisk: overallRisk
      });
      
      const receiptData: Omit<ProcessedReceipt, 'id'> = {
        fileName: selectedFile.name,
        imageUrl: uploadResult.url,
        imageStoragePath: uploadResult.path,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.email,
        companyId: user.companyId || '',
        supervisorId: user.supervisorId || '',
        status: 'pending_approval',
        isFraudulent: fraudResult.isFraudulent,
        fraudProbability: fraudResult.fraudProbability,
        explanation: fraudResult.explanation,
        items: ocrResult.extractedItems || [],
        isDraft: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fraud_analysis: {
          ml_prediction: mlPrediction || undefined,
          ai_detection: aiDetection ? {
            fraudulent: aiDetection.fraudulent,
            fraudProbability: aiDetection.fraudProbability,
            explanation: aiDetection.explanation
          } : undefined,
          overall_risk_assessment: overallRisk,
          analysis_timestamp: new Date().toISOString(),
        },
      };

      console.log('💾 Receipt data with fraud_analysis:', JSON.stringify(receiptData.fraud_analysis, null, 2));
      const savedReceiptId = await addReceipt(receiptData);
      
      // Record receipt upload for subscription usage tracking
      if (user.companyId) {
        await recordReceiptUpload(user.companyId);
      }
      
      updateStep('save', 'completed', 100);
      setUploadProgress(100);

      // Navigate to verification page
      router.push(`/employee/verify-receipt/${savedReceiptId}`);

    } catch (err) {
      console.error('Receipt processing failed:', err);
      
      // Enhanced error handling with specific error messages
      let errorMessage = 'Failed to process receipt';
      if (err instanceof Error) {
        if (err.message.includes('storage/unauthorized')) {
          errorMessage = 'Authentication failed. Please log out and log back in.';
        } else if (err.message.includes('storage/object-not-found')) {
          errorMessage = 'Storage bucket not found. Please check Firebase configuration.';
        } else if (err.message.includes('storage/quota-exceeded')) {
          errorMessage = 'Storage quota exceeded. Please contact support.';
        } else if (err.message.includes('storage/retry-limit-exceeded')) {
          errorMessage = 'Upload failed after multiple attempts. Please try again.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Upload timed out. Please check your internet connection and try again.';
        } else {
          errorMessage = `Upload failed: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      
      // Mark current step as error
      const currentStep = uploadSteps.find(step => step.status === 'in_progress');
      if (currentStep) {
        updateStep(currentStep.id, 'error', 0);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setError(null);
    setUploadProgress(0);
    setExtractedItems([]);
    setIsOcrProcessing(false);
    setOcrProgress(0);
    setOcrConfidence(null);
    setOcrConfidenceBreakdown(null);
    setUploadSteps(prev => prev.map(step => ({ ...step, status: 'pending', progress: 0 })));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upload test Receipt</h1>
      
      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!selectedFile ? (
        <Card>
          <CardContent className="p-8">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drop your receipt here, or click to browse
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Supports JPG, PNG, and WebP files up to 10MB
              </p>
              <Button variant="outline" type="button">
                Choose File
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Image Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Receipt Preview</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="max-w-full h-auto max-h-96 mx-auto rounded-lg border"
                  />
                  <div className="mt-4 text-sm text-gray-600">
                    <p><strong>File:</strong> {selectedFile.name}</p>
                    <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p><strong>Type:</strong> {selectedFile.type}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extracted Items Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Extracted Receipt Data</span>
                {isOcrProcessing && (
                  <div className="flex items-center text-sm text-blue-600">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing: {ocrProgress}%
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isOcrProcessing ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-600">Extracting text from receipt...</span>
                  </div>
                  <Progress value={ocrProgress} className="w-full" />
                </div>
              ) : extractedItems.length > 0 ? (
                <div className="space-y-3">
                  {/* Confidence Score Display */}
                  {ocrConfidence !== null && (
                    <div className="mb-4">
                      <div className={`rounded-lg border-2 p-4 ${
                        ocrConfidence >= 0.8 
                          ? 'bg-green-50 border-green-200' 
                          : ocrConfidence >= 0.6 
                          ? 'bg-amber-50 border-amber-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-semibold text-sm ${
                            ocrConfidence >= 0.8 
                              ? 'text-green-800' 
                              : ocrConfidence >= 0.6 
                              ? 'text-amber-800' 
                              : 'text-red-800'
                          }`}>
                            OCR Confidence Score
                          </span>
                          <span className={`text-lg font-bold ${
                            ocrConfidence >= 0.8 
                              ? 'text-green-700' 
                              : ocrConfidence >= 0.6 
                              ? 'text-amber-700' 
                              : 'text-red-700'
                          }`}>
                            {Math.round(ocrConfidence * 100)}%
                          </span>
                        </div>
                        <Progress 
                          value={ocrConfidence * 100} 
                          className={`h-2 ${
                            ocrConfidence >= 0.8 
                              ? 'bg-green-200' 
                              : ocrConfidence >= 0.6 
                              ? 'bg-amber-200' 
                              : 'bg-red-200'
                          }`}
                        />
                        <p className={`text-xs mt-2 ${
                          ocrConfidence >= 0.8 
                            ? 'text-green-700' 
                            : ocrConfidence >= 0.6 
                            ? 'text-amber-700' 
                            : 'text-red-700'
                        }`}>
                          {ocrConfidence >= 0.8 
                            ? '✅ High confidence - OCR extraction looks accurate' 
                            : ocrConfidence >= 0.6 
                            ? '⚠️ Moderate confidence - Please review extracted data' 
                            : '❌ Low confidence - Manual verification recommended'}
                        </p>
                        {ocrConfidenceBreakdown && (
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <p className="text-xs font-medium mb-2 text-gray-700">Data Completeness: {Math.round(ocrConfidenceBreakdown.dataCompleteness * 100)}%</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(ocrConfidenceBreakdown.perField).map(([field, conf]) => (
                                <div key={field} className="flex justify-between">
                                  <span className="text-gray-600 capitalize">{field}:</span>
                                  <span className={conf > 0.7 ? 'text-green-600' : conf > 0.4 ? 'text-amber-600' : 'text-red-600'}>
                                    {Math.round(conf * 100)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid gap-2">
                    {extractedItems.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="flex justify-between items-center p-2 bg-gray-50 rounded border">
                        <span className="font-medium text-sm text-gray-700">{item.label}:</span>
                        <span className="text-sm text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    ✅ {extractedItems.length} items extracted successfully
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileImage className="mx-auto h-8 w-8 mb-2 text-gray-400" />
                  <p className="text-sm">No data extracted yet</p>
                  <p className="text-xs">OCR processing will start automatically after image upload</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Progress */}
          {isUploading && (
            <Card>
              <CardHeader>
                <CardTitle>Processing Receipt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={uploadProgress} className="w-full" />
                <div className="space-y-2">
                  {uploadSteps.map((step) => (
                    <div key={step.id} className="flex items-center space-x-3">
                      {step.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {step.status === 'in_progress' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                      {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-gray-300" />}
                      <span className={`text-sm ${
                        step.status === 'completed' ? 'text-green-700' :
                        step.status === 'in_progress' ? 'text-blue-700' :
                        step.status === 'error' ? 'text-red-700' :
                        'text-gray-500'
                      }`}>
                        {step.label}
                      </span>
                      {step.status === 'in_progress' && (
                        <Progress value={step.progress} className="w-20" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button
              onClick={processReceipt}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileImage className="mr-2 h-4 w-4" />
                  Process Receipt
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
          
          {/* Debug Information */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Debug Information</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>User ID:</strong> {user?.id}</p>
                <p><strong>User UID:</strong> {user?.uid}</p>
                <p><strong>User Email:</strong> {user?.email}</p>
                <p><strong>File Size:</strong> {selectedFile?.size} bytes</p>
                <p><strong>File Type:</strong> {selectedFile?.type}</p>
                <p><strong>Firebase Config:</strong> {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Loaded' : 'Missing'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Receipt Upload Limit Reached
            </DialogTitle>
            <DialogDescription>
              {usageInfo?.reason || 'You have reached your monthly receipt upload limit.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Current Usage</span>
                <span className="text-sm">
                  {usageInfo?.current || 0} / {usageInfo?.limit || 0} receipts
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full"
                  style={{
                    width: `${Math.min(100, ((usageInfo?.current || 0) / (usageInfo?.limit || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <Alert>
              <AlertDescription>
                To upload more receipts, please upgrade your subscription plan.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowUpgradeDialog(false);
              router.push('/settings/subscription');
            }}>
              <ArrowUpCircle className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
