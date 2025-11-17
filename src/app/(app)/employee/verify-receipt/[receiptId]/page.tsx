
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getReceiptById, updateReceipt } from '@/lib/receipt-store';
import type { ProcessedReceipt, ReceiptDataItem, FraudAnalysis, AIFraudDetection, MLFraudPrediction } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2, FileEdit, FileType, Eye, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
// import { performEnhancedFraudAnalysis } from '@/lib/enhanced-fraud-service'; // Temporarily disabled
import { extractTextWithTesseract } from '@/lib/tesseract-ocr-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context'; // Import useAuth

export default function VerifyReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth(); // Get current user
  const [receipt, setReceipt] = useState<ProcessedReceipt | null | undefined>(undefined);
  const [editableItems, setEditableItems] = useState<ReceiptDataItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const receiptId = params.receiptId as string;

  useEffect(() => {
    const loadReceipt = async () => {
      if (receiptId) {
        try {
          const foundReceipt = await getReceiptById(receiptId);
          setReceipt(foundReceipt);
          if (foundReceipt) {
            setEditableItems(Array.isArray(foundReceipt.items) ? foundReceipt.items.map(item => ({ ...item })) : []);
          }
        } catch (error) {
          console.error('Error loading receipt:', error);
          toast({
            title: 'Error',
            description: 'Failed to load receipt. Please try again.',
            variant: 'destructive',
          });
        }
      }
    };
    
    loadReceipt();
  }, [receiptId, toast]);

  const handleItemChange = (id: string, newValue: string) => {
    setEditableItems(prevItems =>
      prevItems.map(item => (item.id === id ? { ...item, value: newValue } : item))
    );
  };

  const handleAddNewField = () => {
    const newId = `new-field-${Date.now()}`;
    const newItem: ReceiptDataItem = {
      id: newId,
      label: 'New Field',
      value: ''
    };
    setEditableItems(prevItems => [...prevItems, newItem]);
  };

  const handleFieldLabelChange = (id: string, newLabel: string) => {
    setEditableItems(prevItems =>
      prevItems.map(item => (item.id === id ? { ...item, label: newLabel } : item))
    );
  };

  const handleRemoveField = (id: string) => {
    setEditableItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  // Expected fields that should always be available
  const expectedFields = [
    { label: 'Vendor', placeholder: 'Enter vendor/store name' },
    { label: 'Items', placeholder: 'Enter item names (separated by |)' },
    { label: 'Prices', placeholder: 'Enter prices (separated by |)' },
    { label: 'Subtotal', placeholder: 'Enter subtotal amount' },
    { label: 'Tax', placeholder: 'Enter tax amount' },
    { label: 'Total', placeholder: 'Enter total amount' },
    { label: 'Date', placeholder: 'Enter receipt date' }
  ];

  // Ensure all expected fields are present
  const ensureExpectedFields = () => {
    setEditableItems(prevItems => {
      const existingLabels = new Set(prevItems.map(item => item.label.toLowerCase()));
      const missingFields = expectedFields.filter(
        field => !existingLabels.has(field.label.toLowerCase())
      );

      if (missingFields.length > 0) {
        const newItems = missingFields.map(field => ({
          id: `expected-${field.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          label: field.label,
          value: '',
        }));
        return [...prevItems, ...newItems];
      }
      
      return prevItems;
    });
  };

  // Run ensureExpectedFields when receipt loads or OCR completes
  useEffect(() => {
    if (receipt && editableItems.length >= 0) {
      ensureExpectedFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt?.id]);

  const convertImageToDataUri = async (imageUrl: string): Promise<string> => {
    try {
      // If it's already a data URI, return it
      if (imageUrl.startsWith('data:')) {
        console.log('✅ Image is already a data URI');
        return imageUrl;
      }

      console.log('🔄 Converting image URL to data URI:', imageUrl.substring(0, 100) + '...');

      // Try different fetch strategies for Firebase Storage URLs
      let response: Response;
      
      try {
        // First try: Standard fetch with CORS
        response = await fetch(imageUrl, {
          mode: 'cors',
          credentials: 'omit',
          headers: {
            'Accept': 'image/*'
          }
        });
      } catch (corsError) {
        console.warn('CORS fetch failed, trying proxy endpoint:', corsError);
        
        // Second try: Use our proxy endpoint to avoid CORS issues
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          try {
            const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
            console.log('🔄 Using proxy endpoint:', proxyUrl);
            response = await fetch(proxyUrl);
          } catch (proxyError) {
            console.warn('Proxy fetch failed, trying no-cors mode:', proxyError);
            
            // Third try: No-cors mode (limited but might work)
            response = await fetch(imageUrl, {
              mode: 'no-cors',
              credentials: 'omit'
            });
          }
        } else {
          // For non-Firebase URLs, try no-cors mode
          response = await fetch(imageUrl, {
            mode: 'no-cors',
            credentials: 'omit'
          });
        }
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      console.log('✅ Image fetched successfully, converting to blob...');
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error('Received empty image blob');
      }

      console.log('✅ Image blob created, size:', blob.size, 'bytes');

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          console.log('✅ Image converted to data URI successfully');
          resolve(reader.result as string);
        };
        reader.onerror = (error) => {
          console.error('❌ FileReader error:', error);
          reject(new Error('Failed to convert image blob to data URI'));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('❌ Error converting image to data URI:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          if (imageUrl.includes('firebasestorage.googleapis.com')) {
            throw new Error('Cannot access Firebase Storage image. This might be due to CORS restrictions. Try uploading the image again or contact support.');
          }
          throw new Error('Cannot access image URL. This might be due to CORS restrictions or network issues.');
        }
        if (error.message.includes('CORS')) {
          throw new Error('Image access blocked by CORS policy. The image URL may not be accessible from this domain.');
        }
        throw new Error(`Image processing failed: ${error.message}`);
      }
      
      throw new Error('Failed to prepare image for OCR processing');
    }
  };

  const handleTesseractOCR = async () => {
    if (!receipt) return;
    
    setIsOcrProcessing(true);
    setOcrProgress(0);
    
    try {
      toast({
        title: 'Starting Tesseract OCR',
        description: 'Preparing image and extracting text...',
      });

      const imageSource = receipt.imageUrl || receipt.imageDataUri;
      if (!imageSource) {
        throw new Error('No image available for OCR processing');
      }

      console.log('🔍 Tesseract OCR - Image source:', {
        hasImageUrl: !!receipt.imageUrl,
        hasImageDataUri: !!receipt.imageDataUri,
        imageSourceType: imageSource.startsWith('data:') ? 'data-uri' : 'url',
        imageSourceLength: imageSource.length
      });

      // Convert image to data URI format for Tesseract
      setOcrProgress(10);
      const dataUri = await convertImageToDataUri(imageSource);
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setOcrProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      const ocrResult = await extractTextWithTesseract(dataUri);
      
      clearInterval(progressInterval);
      setOcrProgress(100);

      // Merge OCR results with existing items, preserving blank expected fields
      setEditableItems(prevItems => {
        const existingLabels = new Set(prevItems.map(item => item.label.toLowerCase()));
        const ocrItemsMap = new Map(ocrResult.items.map(item => [item.label.toLowerCase(), item]));
        
        // Update existing items with OCR results if they match
        const updatedItems = prevItems.map(item => {
          const ocrItem = ocrItemsMap.get(item.label.toLowerCase());
          if (ocrItem && ocrItem.value.trim()) {
            return ocrItem; // Use OCR value if it exists and is not empty
          }
          return item; // Keep existing value (including empty expected fields)
        });
        
        // Add new OCR items that don't exist yet
        const newOcrItems = ocrResult.items.filter(item => 
          !existingLabels.has(item.label.toLowerCase()) && item.value.trim()
        );
        
        return [...updatedItems, ...newOcrItems];
      });
      
      // Ensure expected fields are still present after merge
      ensureExpectedFields();

      toast({
        title: 'OCR Complete!',
        description: `Extracted ${ocrResult.items.length} items with ${Math.round(ocrResult.confidence * 100)}% confidence`,
      });

    } catch (error) {
      console.error('Tesseract OCR failed:', error);
      toast({
        title: 'OCR Failed',
        description: error instanceof Error ? error.message : 'Failed to extract text from image',
        variant: 'destructive',
      });
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
    }
  };
  
  const openPdfInNewTab = () => {
    if (receipt && isPdf) {
      const pdfUrl = receipt.imageUrl || receipt.imageDataUri;
      window.open(pdfUrl, '_blank');
    }
  };

  const handleConfirmAndAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!receipt) return;

    if (user?.role === 'employee' && (receipt.status === 'approved' || receipt.status === 'rejected')) {
      toast({
        title: 'Receipt Already Reviewed',
        description: `This receipt has been ${receipt.status}. You cannot resubmit it for analysis.`,
      });
      return;
    }

    const needsAttention = editableItems.some(item =>
        (item.label.toLowerCase().includes("vendor") || item.label.toLowerCase().includes("date") || item.label.toLowerCase().includes("total amount")) &&
        (item.value.toLowerCase().includes("extraction failed") || item.value.toLowerCase().includes("not found - edit me") || item.value.trim() === "")
    );

    if (needsAttention && user?.role === 'employee') { // Only employees get this strict check
        toast({
            title: 'Attention Needed',
            description: 'Please review and edit fields marked "Extraction Failed", "Not found - edit me", or empty critical fields (Vendor, Date, Total Amount) before proceeding.',
            variant: 'destructive',
        });
        return;
    }

    setIsProcessing(true);
    try {
      toast({
        title: 'Starting Analysis',
        description: 'Running fraud detection...',
      });

      const amountValue = editableItems.find(item =>
        item.label.toLowerCase().includes('total') ||
        item.label.toLowerCase().includes('amount')
      )?.value || '0';
      const merchantValue = editableItems.find(item =>
        item.label.toLowerCase().includes('vendor') ||
        item.label.toLowerCase().includes('store')
      )?.value || 'Unknown';
      const dateValue = editableItems.find(item =>
        item.label.toLowerCase().includes('date')
      )?.value || receipt.uploadedAt || new Date().toISOString();

      const receiptDataForAnalysis = {
        amount: amountValue,
        merchant: merchantValue,
        date: dateValue,
        category: 'Business Expense',
      };

      // Get ML prediction
      let mlPrediction: MLFraudPrediction | null = null;
      let aiDetection: AIFraudDetection | null = null;

      try {
        console.log('🤖 Calling ML prediction API...');

        const mlResponse = await fetch('/api/ml-predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...receiptDataForAnalysis,
            items: editableItems,
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

      try {
        console.log('🤖 Calling AI fraud analysis API...');

        const aiResponse = await fetch('/api/ai-fraud-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: editableItems,
            imageUrl: receipt.imageUrl || receipt.imageDataUri,
            receiptData: receiptDataForAnalysis
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiDetection = {
            fraudulent: aiData.fraudulent ?? false,
            fraudProbability: aiData.fraudProbability ?? 0.1,
            explanation: aiData.explanation ?? 'AI analysis completed. No fraud indicators detected.',
          };
          console.log('✅ AI analysis received:', aiDetection);
        } else {
          console.warn('⚠️ AI analysis failed:', aiResponse.status);
        }
      } catch (aiError) {
        console.warn('⚠️ AI analysis error:', aiError);
      }

      const mlFraudProbability = mlPrediction?.fraud_probability ?? 0.1;
      const aiFraudProbability = aiDetection?.fraudProbability ?? 0.1;
      const mlWeight = mlPrediction ? 0.6 : 0;
      const aiWeight = aiDetection ? 0.4 : 0;
      const totalWeight = mlWeight + aiWeight;
      const combinedFraudProbability = totalWeight > 0
        ? ((mlFraudProbability * mlWeight) + (aiFraudProbability * aiWeight)) / totalWeight
        : mlFraudProbability;

      let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (combinedFraudProbability >= 0.7) {
        overallRisk = 'HIGH';
      } else if (combinedFraudProbability >= 0.4) {
        overallRisk = 'MEDIUM';
      }

      const isActuallyFraudulent = (mlPrediction?.is_fraudulent ?? false) || (aiDetection?.fraudulent ?? false);

      let combinedExplanation = '';
      if (mlPrediction) {
        combinedExplanation += `ML Analysis: ${mlPrediction.risk_level} risk (${(mlPrediction.fraud_probability * 100).toFixed(1)}% fraud probability). `;
      }
      if (aiDetection?.explanation) {
        combinedExplanation += `AI Analysis: ${aiDetection.explanation}`;
      }
      if (!combinedExplanation) {
        combinedExplanation = 'Receipt processed successfully. No fraud detected.';
      }

      const fraudAnalysis: FraudAnalysis = {
        ml_prediction: mlPrediction || undefined,
        ai_detection: aiDetection || undefined,
        overall_risk_assessment: overallRisk,
        analysis_timestamp: new Date().toISOString(),
      };

      const finalReceipt: ProcessedReceipt = {
        ...receipt,
        items: editableItems,
        // Legacy fields for backward compatibility
        isFraudulent: isActuallyFraudulent,
        fraudProbability: combinedFraudProbability,
        explanation: combinedExplanation.trim(),
        // New comprehensive analysis
        fraud_analysis: fraudAnalysis,
        status: 'pending_approval', // Always set to pending_approval when employee submits
        isDraft: false, // Clear draft status when resubmitting
      };

      await updateReceipt(finalReceipt);

      toast({
        title: `Receipt ${user?.role === 'manager' ? 'Updated' : 'Verified'} & Analyzed!`,
        description: `${fraudAnalysis.overall_risk_assessment || 'LOW'} risk (${(combinedFraudProbability * 100).toFixed(1)}% fraud probability)`,
      });

      if (user?.role === 'manager') {
        router.push('/manager/dashboard');
      } else {
        router.push(`/employee/receipt/${finalReceipt.id}`);
      }

    } catch (error: any) {
      console.error('Error during fraud analysis:', error);
      toast({
        title: 'Analysis Error',
        description: error.message || 'Could not analyze the receipt. Please try again.',
        variant: 'destructive',
      });
       if (receipt && !receipt.explanation.toLowerCase().includes("error occurred during ai fraud analysis")) {
         const errorReceipt = {
            ...receipt,
            explanation: "A local error occurred while preparing data for fraud analysis. Please check your inputs or try again."
         }
         updateReceipt(errorReceipt);
       }
    } finally {
      setIsProcessing(false);
    }
  };

  if (receipt === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] bg-[var(--color-bg)] text-[var(--color-text)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        Loading receipt for verification...
      </div>
    );
  }

  if (receipt === null) {
    return (
      <Card className="max-w-2xl mx-auto my-8 shadow-lg bg-[var(--color-card)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-destructive flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2" />
            Receipt Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[var(--color-text)]">The receipt you are looking for could not be found for verification.</p>
          <Button onClick={() => router.push(user?.role === 'manager' ? '/manager/dashboard' : '/employee/dashboard')} className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isExtractionEssentiallyFailed = editableItems.length > 0 && editableItems.every(item => item.value.toLowerCase().includes("extraction failed") || item.value.toLowerCase().includes("not found - edit me"));
  const pageTitle = user?.role === 'manager' ? `Review & Edit Receipt: ${receipt.fileName}` : `Verify Receipt Data: ${receipt.fileName}`;
  const isEmployeeFinalized = user?.role === 'employee' && (receipt.status === 'approved' || receipt.status === 'rejected');
  const submitButtonText = user?.role === 'manager'
    ? 'Save Changes & Re-analyze'
    : isEmployeeFinalized
      ? 'Analysis Locked'
      : 'Confirm & Analyze Fraud';
  const imageSource = receipt.imageUrl || receipt.imageDataUri;
  const isPdf = imageSource?.startsWith('data:application/pdf') || receipt.fileName.toLowerCase().endsWith('.pdf');

  return (
    <Card className="max-w-4xl mx-auto my-8 shadow-xl bg-[var(--color-card)] border-[var(--color-border)]">
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-headline flex items-center gap-2 text-[var(--color-text)]">
                <FileEdit className="w-7 h-7 text-primary"/>
                {pageTitle}
            </CardTitle>
            <Button onClick={() => router.back()} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
        </div>
        <CardDescription className="text-[var(--color-text-secondary)]">
          Review the extracted information below. Edit any field as necessary, then confirm to proceed.
          If fields show "Extraction Failed" or are incorrect, use the "Re-extract with Tesseract" button to try Tesseract OCR, or correct them manually using the receipt image as a reference.
          {user?.role === 'manager' && " As a manager, saving changes will re-trigger fraud analysis."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleConfirmAndAnalyze}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2 text-[var(--color-text)]">Receipt Document</h3>
                {isPdf ? (
                    <div className="border border-[var(--color-border)] rounded-lg shadow-md bg-[var(--color-bg-secondary)] min-h-[300px] md:min-h-[400px] h-full flex flex-col items-center justify-center p-4">
                      <FileType className="w-16 h-16 text-[var(--color-text-secondary)] mb-4" />
                      <p className="text-sm text-center mb-4 text-[var(--color-text-secondary)]">The preview is not available here due to security restrictions.</p>
                      <Button type="button" onClick={openPdfInNewTab}>
                        <Eye className="mr-2 h-4 w-4" /> View Full PDF
                      </Button>
                    </div>
                ) : (
                  <div className="relative border border-[var(--color-border)] rounded-lg overflow-hidden shadow-md bg-[var(--color-bg-secondary)] min-h-[300px] md:min-h-[400px] h-full">
                    <Image
                      src={imageSource || ''}
                      alt={`Receipt ${receipt.fileName}`}
                      fill
                      style={{objectFit: 'contain'}}
                      className="p-1"
                      data-ai-hint="receipt full"
                    />
                  </div>
                )}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg text-[var(--color-text)]">Receipt Information (Editable)</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddNewField}
                    disabled={isProcessing}
                    className="text-xs"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Field
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTesseractOCR}
                    disabled={isOcrProcessing || isProcessing}
                    className="text-xs"
                  >
                    {isOcrProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        OCR: {ocrProgress}%
                      </>
                    ) : (
                      <>
                        <FileType className="mr-2 h-3 w-3" />
                        Re-extract with Tesseract
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[300px] md:h-[400px] pr-3 border border-[var(--color-border)] rounded-md p-3 bg-[var(--color-bg-secondary)] shadow-inner">
                 {editableItems.length === 0 && (
                  <p className="text-sm text-[var(--color-text-secondary)] p-4 text-center">
                    No items were extracted. This might be due to image quality.
                    Try using the "Re-extract with Tesseract" button above, or upload a clearer image.
                  </p>
                 )}
                 {isExtractionEssentiallyFailed && editableItems.some(item => item.label === "Note") && (
                    <div className="mb-3 p-3 border border-yellow-500 bg-yellow-500/10 rounded-md">
                        <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">{editableItems.find(item => item.label === "Note")?.value}</p>
                    </div>
                 )}

                {editableItems.filter(item => item.label !== "Note").map((item, index) => {
                  const isEmpty = !item.value || item.value.trim() === '';
                  const isExpectedField = expectedFields.some(f => f.label.toLowerCase() === item.label.toLowerCase());
                  const fieldConfig = expectedFields.find(f => f.label.toLowerCase() === item.label.toLowerCase());
                  const isCustomField = item.id.startsWith('new-field-');
                  
                  return (
                    <div 
                      key={`${item.id}-${item.label}-${index}`} 
                      className={`mb-3 p-2 rounded-md border ${
                        isEmpty && isExpectedField 
                          ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' 
                          : 'border-[var(--color-border)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {isCustomField ? (
                          <Input
                            id={`label-${item.id}`}
                            type="text"
                            value={item.label}
                            onChange={(e) => handleFieldLabelChange(item.id, e.target.value)}
                            className="flex-1 text-sm font-medium bg-[var(--color-bg)] h-8"
                            disabled={isProcessing}
                            placeholder="Field name"
                          />
                        ) : (
                          <Label htmlFor={item.id} className="text-sm font-medium text-[var(--color-text)] flex-1">
                            {item.label}
                            {isEmpty && isExpectedField && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">
                                (Required - Please fill in)
                              </span>
                            )}
                          </Label>
                        )}
                        {isCustomField && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveField(item.id)}
                            disabled={isProcessing}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Remove field"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <Input
                        id={item.id}
                        type="text"
                        value={item.value}
                        onChange={(e) => handleItemChange(item.id, e.target.value)}
                        className={`text-sm bg-[var(--color-bg)] ${
                          isEmpty && isExpectedField ? 'border-amber-300 focus:border-amber-500' : ''
                        }`}
                        disabled={isProcessing}
                        placeholder={fieldConfig?.placeholder || `Enter ${item.label.toLowerCase()}`}
                      />
                    </div>
                  );
                })}
              </ScrollArea>
               <p className="text-xs text-[var(--color-text-secondary)] mt-1 px-1">
                  Ensure key details like Vendor, Total Amount, and Date are accurate.
                  Correct any "Extraction Failed" or "Not found" values if visible on the receipt.
                </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => router.push(user?.role === 'manager' ? '/manager/dashboard' : '/employee/dashboard')} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isProcessing ||
              editableItems.length === 0 ||
              editableItems.filter(item => item.label !== "Note").length === 0 ||
              isEmployeeFinalized
            }
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            {isProcessing ? 'Processing...' : submitButtonText}
          </Button>
        </CardFooter>
        {isEmployeeFinalized && (
          <div className="px-6 pb-6 text-xs text-muted-foreground text-right">
            This receipt has already been {receipt.status} and cannot be re-analyzed.
          </div>
        )}
      </form>
    </Card>
  );
}
