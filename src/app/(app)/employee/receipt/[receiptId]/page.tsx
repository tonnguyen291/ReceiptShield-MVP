
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getReceiptById } from '@/lib/receipt-store';
import type { ProcessedReceipt, ReceiptDataItem } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, Info, MessageSquareText, ShieldQuestion, CheckCircle, XCircle, Brain, Bot, TrendingUp, FileType, Eye, Edit3, FileImage } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { summarizeAIAnalysis } from '@/lib/ai-analysis-summarizer';


export default function ReceiptDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [receipt, setReceipt] = useState<ProcessedReceipt | null | undefined>(undefined); // undefined for loading state
  const receiptId = params.receiptId as string;

  // Helper function to safely format dates
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  useEffect(() => {
    const loadReceipt = async () => {
      if (receiptId) {
        try {
          const foundReceipt = await getReceiptById(receiptId);
          console.log('Loaded receipt data:', {
            id: foundReceipt?.id,
            fileName: foundReceipt?.fileName,
            hasImageUrl: !!foundReceipt?.imageUrl,
            hasImageDataUri: !!foundReceipt?.imageDataUri,
            imageUrl: foundReceipt?.imageUrl?.substring(0, 100),
            imageDataUri: foundReceipt?.imageDataUri?.substring(0, 100),
            fullReceipt: foundReceipt
          });
          setReceipt(foundReceipt || null);
        } catch (error) {
          console.error('Error loading receipt:', error);
          setReceipt(null);
        }
      }
    };
    
    loadReceipt();
  }, [receiptId]);
  
  // Determine image source and check if it's a PDF (calculate before early returns)
  const imageSource = receipt?.imageUrl || receipt?.imageDataUri;
  const hasValidImageSource = imageSource && imageSource.trim() !== '';
  const isPdf = hasValidImageSource && (imageSource.startsWith('data:application/pdf') || receipt?.fileName?.toLowerCase().endsWith('.pdf'));
  
  // Log image source for debugging (must be before early returns to maintain hook order)
  useEffect(() => {
    if (receipt) {
      console.log('Image source debug:', {
        hasImageUrl: !!receipt.imageUrl,
        hasImageDataUri: !!receipt.imageDataUri,
        imageUrl: receipt.imageUrl?.substring(0, 100),
        imageDataUri: receipt.imageDataUri?.substring(0, 100),
        imageSource,
        hasValidImageSource,
        isPdf
      });
    }
  }, [receipt, imageSource, hasValidImageSource, isPdf]);
  
  const handleBackToDashboard = () => {
    if (user?.role === 'manager') {
      router.push('/manager/dashboard');
    } else {
      router.push('/employee/dashboard');
    }
  };
  
  const openPdfInNewTab = () => {
    const imageSource = receipt?.imageUrl || receipt?.imageDataUri;
    const hasValidImageSource = imageSource && imageSource.trim() !== '';
    if (receipt && hasValidImageSource && (imageSource.startsWith('data:application/pdf') || receipt.fileName?.toLowerCase().endsWith('.pdf'))) {
      const pdfWindow = window.open("");
      if (pdfWindow) {
        pdfWindow.document.write(`<iframe width='100%' height='100%' title='${receipt.fileName}' src='${imageSource}'></iframe>`);
        pdfWindow.document.title = receipt.fileName;
      }
    }
  };

  if (receipt === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p>Loading receipt details...</p>
      </div>
    );
  }

  if (receipt === null) {
    return (
      <Card className="max-w-3xl mx-auto my-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-destructive flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2" />
            Receipt Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>The receipt you are looking for could not be found. It might have been deleted or the ID is incorrect.</p>
          <Button onClick={handleBackToDashboard} className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fraudProbabilityPercent = Math.round(receipt.fraudProbability * 100);

  const getStatusBadge = () => {
    if (receipt.status === 'approved') {
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle className="w-4 h-4 mr-1.5"/>Approved by Manager</Badge>;
    }
    if (receipt.status === 'draft' || receipt.isDraft) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600"><Edit3 className="w-4 h-4 mr-1.5"/>Needs More Info</Badge>;
    }
    if (receipt.status === 'pending_approval') {
      return <Badge variant="secondary"><ShieldQuestion className="w-4 h-4 mr-1.5"/>Pending Manager Review</Badge>;
    }
    return <Badge variant={receipt.isFraudulent ? 'destructive' : 'default'} className="text-sm px-3 py-1">
            {receipt.isFraudulent ? 'Flagged as Potentially Fraudulent' : 'Looks Clear (AI)'}
           </Badge>;
  };

  return (
    <Card className="w-full mx-auto my-8 shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-3xl font-headline mb-1">{receipt.fileName}</CardTitle>
                <CardDescription>
                Uploaded by: {receipt.uploadedBy || 'Unknown user'} on {formatDate(receipt.uploadedAt)}
                </CardDescription>
            </div>
            <Button onClick={handleBackToDashboard} variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {/* Receipt Image Column */}
          <div className="md:col-span-1 space-y-4">
            <h3 className="font-semibold text-xl">Receipt Document</h3>
             {isPdf ? (
                <div className="border rounded-lg shadow-md bg-muted h-[calc(80vh-150px)] min-h-[400px] flex flex-col items-center justify-center p-4">
                  <FileType className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-center mb-4 text-muted-foreground">The preview is not available here due to security restrictions.</p>
                  <Button onClick={openPdfInNewTab}>
                    <Eye className="mr-2 h-4 w-4" /> View Full PDF
                  </Button>
                </div>
              ) : hasValidImageSource ? (
                <div className="border rounded-lg overflow-hidden shadow-md relative bg-muted h-[calc(80vh-150px)] min-h-[400px]">
                  {imageSource.startsWith('http') ? (
                    // For Firebase Storage URLs, use regular img tag
                    <img
                      src={imageSource}
                      alt={`Receipt ${receipt.fileName}`}
                      className="absolute inset-0 w-full h-full object-contain p-2"
                      style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0}}
                      onError={(e) => {
                        console.error('Image load error:', {
                          src: imageSource,
                          error: e
                        });
                        // Try to use proxy if Firebase Storage URL fails
                        if (imageSource.includes('firebasestorage.googleapis.com')) {
                          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageSource)}`;
                          e.currentTarget.src = proxyUrl;
                        }
                      }}
                    />
                  ) : (
                    // For data URIs, use Next.js Image component
                    <Image
                      src={imageSource}
                      alt={`Receipt ${receipt.fileName}`}
                      fill
                      style={{objectFit: 'contain'}}
                      className="p-2"
                      unoptimized={imageSource.startsWith('data:')}
                      data-ai-hint="receipt full"
                      onError={(e) => {
                        console.error('Next.js Image load error:', {
                          src: imageSource.substring(0, 100),
                          error: e
                        });
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden shadow-md relative bg-muted h-[calc(80vh-150px)] min-h-[400px] flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-muted-foreground/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileImage className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Image Not Available</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      The receipt image could not be loaded. This might be due to:
                    </p>
                    <ul className="text-sm text-muted-foreground text-left space-y-1 mb-4">
                      <li>• Image file was not properly uploaded</li>
                      <li>• Image URL is invalid or expired</li>
                      <li>• Network connectivity issues</li>
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      File: {receipt.fileName || 'Unknown file'}
                    </p>
                  </div>
                </div>
              )}
          </div>

          {/* Details Sidebar Column */}
          <div className="md:col-span-1 space-y-6 flex flex-col">
            <div className="flex-grow space-y-4">
              <h3 className="font-semibold text-xl text-primary">Review & Analysis</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                  <span className="text-sm font-medium">Overall Status:</span>
                  {getStatusBadge()}
                </div>
                {/* Combined Fraud Analysis Results */}
                {receipt.fraud_analysis ? (
                  <div className="space-y-3">
                    {/* Overall Risk Assessment */}
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Overall Risk Assessment:
                      </span>
                      <Badge 
                        variant={
                          receipt.fraud_analysis.overall_risk_assessment === 'HIGH' ? 'destructive' :
                          receipt.fraud_analysis.overall_risk_assessment === 'MEDIUM' ? 'secondary' : 'default'
                        }
                        className={
                          receipt.fraud_analysis.overall_risk_assessment === 'HIGH' ? 'bg-red-500' :
                          receipt.fraud_analysis.overall_risk_assessment === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                        }
                      >
                        {receipt.fraud_analysis.overall_risk_assessment} RISK
                      </Badge>
                    </div>

                    {/* ML Model Results */}
                    {receipt.fraud_analysis.ml_prediction ? (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium flex items-center gap-2">
                            <Brain className="w-4 h-4 text-blue-600" />
                            ML Model Analysis:
                          </span>
                          <Badge variant="outline" className="border-blue-300">
                            {receipt.fraud_analysis.ml_prediction.risk_level} RISK
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={Math.round(receipt.fraud_analysis.ml_prediction.fraud_probability * 100)} 
                            className="w-full h-2"
                            indicatorClassName="bg-blue-500"
                          />
                          <span className="font-semibold text-sm text-blue-600 min-w-[45px]">
                            {Math.round(receipt.fraud_analysis.ml_prediction.fraud_probability * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Confidence: {Math.round(receipt.fraud_analysis.ml_prediction.confidence * 100)}%
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-950/20 rounded-md border border-gray-200">
                        <span className="text-sm font-medium flex items-center gap-2 text-gray-600">
                          <Brain className="w-4 h-4" />
                          ML Model: Unavailable (server offline)
                        </span>
                      </div>
                    )}

                    {/* AI Analysis Results */}
                    {receipt.fraud_analysis.ai_detection ? (
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-md border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium flex items-center gap-2">
                            <Bot className="w-4 h-4 text-purple-600" />
                            AI Analysis:
                          </span>
                          <Badge variant="outline" className="border-purple-300">
                            {receipt.fraud_analysis.ai_detection.fraudulent ? 'FLAGGED' : 'CLEAR'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Progress 
                            value={Math.round(receipt.fraud_analysis.ai_detection.fraudProbability * 100)} 
                            className="w-full h-2"
                            indicatorClassName="bg-purple-500"
                          />
                          <span className="font-semibold text-sm text-purple-600 min-w-[45px]">
                            {Math.round(receipt.fraud_analysis.ai_detection.fraudProbability * 100)}%
                          </span>
                        </div>
                        <div className="mt-2">
                          <ScrollArea className="h-32 max-h-40">
                            <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed pr-2">
                              {summarizeAIAnalysis(receipt.fraud_analysis.ai_detection.explanation)}
                            </p>
                          </ScrollArea>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-950/20 rounded-md border border-gray-200">
                        <span className="text-sm font-medium flex items-center gap-2 text-gray-600">
                          <Bot className="w-4 h-4" />
                          AI Analysis: Unavailable
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Legacy Display for Old Receipts */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md shadow-sm">
                      <span className="text-sm font-medium">Fraud Probability:</span>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={fraudProbabilityPercent} 
                          className="w-28 h-2.5"
                          indicatorClassName={
                            fraudProbabilityPercent > 70 ? 'bg-destructive' :
                            fraudProbabilityPercent > 40 ? 'bg-yellow-500' : 'bg-green-500'
                          }
                        />
                        <span className={`font-semibold text-sm ${fraudProbabilityPercent > 70 ? 'text-destructive' : fraudProbabilityPercent > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {fraudProbabilityPercent}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1 p-3 bg-muted/50 rounded-md shadow-sm">
                      <span className="text-sm font-medium">Analysis Explanation:</span>
                      <ScrollArea className="h-36">
                          <p className="text-xs p-2 rounded-md min-h-[40px] leading-relaxed">
                            {receipt.explanation ? summarizeAIAnalysis(receipt.explanation) : 'No explanation provided.'}
                          </p>
                      </ScrollArea>
                    </div>
                  </div>
                )}
                {receipt.managerNotes && (
                  <Card className={`mt-3 shadow-sm ${
                    (receipt.status === 'draft' || receipt.isDraft || receipt.status === 'rejected') 
                      ? 'border-orange-500 border-2 bg-orange-50 dark:bg-orange-950/20' 
                      : ''
                  }`}>
                    <CardHeader className="p-4">
                      <CardTitle className={`text-lg flex items-center gap-2 ${
                        (receipt.status === 'draft' || receipt.isDraft || receipt.status === 'rejected')
                          ? 'text-orange-700 dark:text-orange-400'
                          : ''
                      }`}>
                        <MessageSquareText className={`w-5 h-5 ${
                          (receipt.status === 'draft' || receipt.isDraft || receipt.status === 'rejected')
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-accent'
                        }`}/>
                        {(receipt.status === 'draft' || receipt.isDraft || receipt.status === 'rejected')
                          ? 'Action Required: Manager Feedback'
                          : 'Manager Notes'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className={`p-4 rounded-md ${
                        (receipt.status === 'draft' || receipt.isDraft || receipt.status === 'rejected')
                          ? 'bg-white dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800'
                          : 'bg-muted/50'
                      }`}>
                        <p className={`whitespace-pre-wrap leading-relaxed ${
                          (receipt.status === 'draft' || receipt.isDraft || receipt.status === 'rejected')
                            ? 'text-sm font-medium text-orange-900 dark:text-orange-200'
                            : 'text-sm text-muted-foreground'
                        }`}>
                          {receipt.managerNotes}
                        </p>
                      </div>
                      {(receipt.status === 'draft' || receipt.isDraft) && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                          <p className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            <span>Please review the feedback above and make necessary corrections before resubmitting.</span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <Separator />
            
            <div>
              <h3 className="font-semibold text-xl text-primary mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Extracted Details
              </h3>
              <ScrollArea className="h-[calc(40vh-100px)] min-h-[200px] border rounded-md p-1 bg-muted/50 shadow-inner">
                <div className="p-3 space-y-2">
                {receipt.items && receipt.items.length > 0 ? (
                  receipt.items.map((item) => (
                    <div key={item.id} className="text-sm grid grid-cols-3 gap-1 even:bg-muted/30 p-1 rounded">
                      <span className="font-medium col-span-1 truncate pr-1">{item.label}:</span>
                      <span className="col-span-2 text-foreground/90 break-words">{item.value}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground p-2">No specific items were extracted or confirmed for this receipt.</p>
                )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
      
       {receipt.status && (receipt.status === 'approved' || receipt.status === 'rejected') && (
        <CardFooter className="pt-4 border-t mt-6">
            <p className="text-sm text-muted-foreground w-full text-center">
                This receipt has been {receipt.status} by management.
            </p>
        </CardFooter>
      )}
    </Card>
  );
}
