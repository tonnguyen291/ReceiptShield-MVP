
'use client';

import Image from 'next/image';
import type { ProcessedReceipt, ReceiptDataItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '../ui/separator';
import { Info, CheckCircle, XCircle, ShieldQuestion, FileType, Eye, Edit3 } from 'lucide-react';
import { ReceiptActions } from './receipt-actions';
import { summarizeAIAnalysis } from '@/lib/ai-analysis-summarizer';

interface ReceiptDetailsDialogProps {
  receipt: ProcessedReceipt | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

export function ReceiptDetailsDialog({ receipt, isOpen, onClose, onActionComplete }: ReceiptDetailsDialogProps) {
  if (!receipt) return null;

  const fraudProbabilityPercent = Math.round(receipt.fraudProbability * 100);
  const isPdf = receipt.imageDataUri?.startsWith('data:application/pdf');
  
  const openPdfInNewTab = () => {
    if (receipt && isPdf) {
      const pdfWindow = window.open("");
      if (pdfWindow) {
        pdfWindow.document.write(`<iframe width='100%' height='100%' title='${receipt.fileName}' src='${receipt.imageDataUri}'></iframe>`);
        pdfWindow.document.title = receipt.fileName;
      }
    }
  };

  const getStatusBadge = () => {
    if (receipt.status === 'approved') {
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1"/>Approved</Badge>;
    }
    if (receipt.status === 'draft' || receipt.isDraft) {
      return <Badge variant="outline" className={receipt.managerNotes?.includes('Request for more information') ? "border-orange-500 text-orange-600" : "border-gray-500 text-gray-600"}><Edit3 className="w-3 h-3 mr-1"/>{receipt.managerNotes?.includes('Request for more information') ? 'Needs More Info' : 'Draft'}</Badge>;
    }
    if (receipt.status === 'pending_approval') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200"><ShieldQuestion className="w-3 h-3 mr-1"/>Pending Review</Badge>;
    }
    // Fallback for older receipts or other states
    return <Badge variant={receipt.isFraudulent ? 'destructive' : 'default'}>
            {receipt.isFraudulent ? 'Flagged' : 'Looks Clear'}
           </Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-headline">Receipt Details: {receipt.fileName}</DialogTitle>
          <DialogDescription>
            Uploaded by: {receipt.uploadedBy} on {new Date(receipt.uploadedAt).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Receipt Document</h3>
               {isPdf ? (
                <div className="border rounded-lg shadow-md bg-muted min-h-[300px] md:min-h-[400px] flex flex-col items-center justify-center p-4">
                  <FileType className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-sm text-center mb-4 text-muted-foreground">The preview is not available here due to security restrictions.</p>
                  <Button onClick={openPdfInNewTab}>
                    <Eye className="mr-2 h-4 w-4" /> View Full PDF
                  </Button>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden shadow-md relative min-h-[300px] md:min-h-[400px]">
                  <Image
                    src={receipt.imageDataUri || ''}
                    alt={`Receipt ${receipt.fileName}`}
                    fill
                    style={{objectFit: 'contain'}}
                    className="p-1"
                    data-ai-hint="receipt image"
                  />
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1 flex items-center gap-1">
                  <Info className="w-5 h-5 text-primary"/>
                  Extracted Details
                  </h3>
                <ScrollArea className="h-40 border rounded-md p-1 bg-muted/30">
                  <div className="p-2 space-y-1.5">
                    {receipt.items && receipt.items.length > 0 ? (
                      receipt.items.map((item) => (
                        <div key={item.id} className="text-sm grid grid-cols-3 gap-1 even:bg-muted/20 p-1 rounded">
                          <span className="font-medium col-span-1 truncate pr-1">{item.label}:</span>
                          <span className="col-span-2 text-foreground/90 break-words">{item.value}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground p-2">No specific items were extracted.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-1">Fraud Analysis & Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-sm">
                    <span className="text-sm font-medium">Overall Status:</span>
                    {getStatusBadge()}
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-sm">
                    <span className="text-sm font-medium">AI Fraud Probability:</span>
                    <span className={`font-semibold ${fraudProbabilityPercent > 70 ? 'text-destructive' : fraudProbabilityPercent > 40 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {fraudProbabilityPercent}%
                    </span>
                  </div>
                   <div className="space-y-1 p-2 bg-muted/50 rounded-sm">
                     <span className="text-sm font-medium">AI Explanation:</span>
                     <ScrollArea className="h-24 mt-1">
                        <p className="text-xs p-1.5 rounded-md leading-relaxed pr-2">
                          {summarizeAIAnalysis(
                            receipt.fraud_analysis?.ai_detection?.explanation || 
                            receipt.explanation || 
                            'No AI explanation provided.'
                          )}
                        </p>
                     </ScrollArea>
                   </div>
                   {receipt.managerNotes && (
                    <div className="space-y-1 p-2 bg-muted/50 rounded-sm">
                      <span className="text-sm font-medium">Manager Notes:</span>
                      <ScrollArea className="h-16">
                          <p className="text-xs p-1.5 rounded-md min-h-[20px] whitespace-pre-wrap">{receipt.managerNotes}</p>
                      </ScrollArea>
                    </div>
                   )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="mt-2 flex-col sm:flex-row gap-2">
          <div className="flex-1">
            {receipt.status !== 'approved' && receipt.status !== 'rejected' && (
              <ReceiptActions 
                receipt={receipt} 
                onActionComplete={() => {
                  onActionComplete?.();
                  onClose();
                }}
                variant="dialog"
              />
            )}
          </div>
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
