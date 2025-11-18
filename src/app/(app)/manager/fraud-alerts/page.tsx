"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Eye, CheckCircle, XCircle, X, ZoomIn, ExternalLink, Loader2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getReceiptsForManager } from "@/lib/receipt-store";
import { getEmployeesForManager, initializeDefaultUsers } from "@/lib/firebase-user-store";
import { getReceiptTotalAmount } from "@/lib/data-service";
import { useAuth } from "@/contexts/auth-context";
import type { ProcessedReceipt } from "@/types";

// Interface for fraud alert derived from ProcessedReceipt
interface FraudAlert {
  id: string;
  receiptId: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  employee: string;
  amount: string;
  date: string;
  status: 'pending' | 'investigating' | 'resolved' | 'rejected';
  receiptImage: string;
  fraudProbability: number;
  uploadedBy: string;
  supervisorId?: string;
}

export default function ManagerFraudAlertsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Real-time fraud analysis functions (same as admin page)
  const analyzeReceiptForFraud = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]): {
    isFraudulent: boolean;
    fraudType: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    fraudProbability: number;
  } => {
    const fraudIndicators: string[] = [];
    let fraudScore = 0;
    let fraudType = "Suspicious Activity";
    let severity: 'low' | 'medium' | 'high' = 'low';

    // 1. Check if receipt is already marked as fraudulent
    if (receipt.isFraudulent) {
      fraudScore += 0.9;
      fraudType = "Flagged as Fraudulent";
      severity = 'high';
      fraudIndicators.push("Receipt has been flagged as potentially fraudulent");
    }

    // 2. Duplicate Receipt Detection
    const duplicateAnalysis = detectDuplicateReceipts(receipt, allReceipts);
    if (duplicateAnalysis.isDuplicate) {
      fraudIndicators.push(`Duplicate receipt detected: ${duplicateAnalysis.description}`);
      fraudScore += 0.8;
      fraudType = "Duplicate Receipt";
    }

    // 3. Amount Analysis
    const amountAnalysis = analyzeReceiptAmount(receipt, allReceipts);
    if (amountAnalysis.isSuspicious) {
      fraudIndicators.push(`Suspicious amount: ${amountAnalysis.description}`);
      fraudScore += amountAnalysis.severity === 'high' ? 0.7 : amountAnalysis.severity === 'medium' ? 0.5 : 0.3;
      if (fraudType === "Suspicious Activity") fraudType = "Suspicious Amount";
    }

    // 4. Vendor Analysis
    const vendorAnalysis = analyzeVendor(receipt, allReceipts);
    if (vendorAnalysis.isSuspicious) {
      fraudIndicators.push(`Unusual vendor: ${vendorAnalysis.description}`);
      fraudScore += 0.4;
      if (fraudType === "Suspicious Activity") fraudType = "Unusual Vendor";
    }

    // 5. Timing Analysis
    const timingAnalysis = analyzeTiming(receipt, allReceipts);
    if (timingAnalysis.isSuspicious) {
      fraudIndicators.push(`Unusual timing: ${timingAnalysis.description}`);
      fraudScore += 0.3;
      if (fraudType === "Suspicious Activity") fraudType = "Unusual Timing";
    }

    // 6. Pattern Analysis
    const patternAnalysis = analyzeSpendingPatterns(receipt, allReceipts);
    if (patternAnalysis.isSuspicious) {
      fraudIndicators.push(`Unusual spending pattern: ${patternAnalysis.description}`);
      fraudScore += 0.4;
    }

    // Determine severity based on fraud score
    if (fraudScore >= 0.7) {
      severity = 'high';
    } else if (fraudScore >= 0.4) {
      severity = 'medium';
    } else if (fraudScore > 0) {
      severity = 'low';
    }

    const isFraudulent = fraudScore > 0.3 || receipt.isFraudulent;
    const description = fraudIndicators.length > 0 
      ? fraudIndicators.join('; ') 
      : "No fraud indicators detected";

    return {
      isFraudulent,
      fraudType,
      severity,
      description,
      fraudProbability: Math.min(fraudScore, 1.0)
    };
  };

  // Duplicate receipt detection
  const detectDuplicateReceipts = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]) => {
    const receiptAmount = getReceiptTotalAmount(receipt);
    const receiptDate = new Date(receipt.uploadedAt);
    const receiptVendor = extractVendor(receipt);

    // Find receipts from the same user within 7 days
    const recentReceipts = allReceipts.filter(r => 
      r.uploadedBy === receipt.uploadedBy &&
      r.id !== receipt.id &&
      Math.abs(new Date(r.uploadedAt).getTime() - receiptDate.getTime()) < 7 * 24 * 60 * 60 * 1000
    );

    // Check for exact duplicates (same amount, vendor, and date)
    const exactDuplicates = recentReceipts.filter(r => {
      const rAmount = getReceiptTotalAmount(r);
      const rVendor = extractVendor(r);
      const rDate = new Date(r.uploadedAt);
      
      return Math.abs(rAmount - receiptAmount) < 0.01 && 
             rVendor.toLowerCase() === receiptVendor.toLowerCase() &&
             Math.abs(rDate.getTime() - receiptDate.getTime()) < 24 * 60 * 60 * 1000;
    });

    if (exactDuplicates.length > 0) {
      return {
        isDuplicate: true,
        description: `Exact duplicate found: same amount ($${receiptAmount.toFixed(2)}), vendor (${receiptVendor}), and date`
      };
    }

    // Check for similar receipts (same amount, different vendor)
    const similarAmounts = recentReceipts.filter(r => {
      const rAmount = getReceiptTotalAmount(r);
      return Math.abs(rAmount - receiptAmount) < 0.01;
    });

    if (similarAmounts.length > 0) {
      return {
        isDuplicate: true,
        description: `Similar amount ($${receiptAmount.toFixed(2)}) found in recent receipts`
      };
    }

    return { isDuplicate: false, description: "" };
  };

  // Amount analysis
  const analyzeReceiptAmount = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]) => {
    const amount = getReceiptTotalAmount(receipt);
    const userReceipts = allReceipts.filter(r => r.uploadedBy === receipt.uploadedBy && r.id !== receipt.id);
    
    if (userReceipts.length === 0) return { isSuspicious: false, description: "", severity: 'low' as const };

    const amounts = userReceipts.map(getReceiptTotalAmount).filter(a => a > 0);
    if (amounts.length === 0) return { isSuspicious: false, description: "", severity: 'low' as const };

    const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    const maxAmount = Math.max(...amounts);
    const stdDev = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length);

    // Check for unusually high amounts
    if (amount > maxAmount * 2) {
      return {
        isSuspicious: true,
        description: `Amount ($${amount.toFixed(2)}) is more than double the user's highest previous receipt ($${maxAmount.toFixed(2)})`,
        severity: 'high' as const
      };
    }

    if (amount > avgAmount + (3 * stdDev)) {
      return {
        isSuspicious: true,
        description: `Amount ($${amount.toFixed(2)}) is significantly higher than user's average ($${avgAmount.toFixed(2)})`,
        severity: 'medium' as const
      };
    }

    // Check for round numbers (potential fake receipts)
    if (amount % 100 === 0 && amount > 100) {
      return {
        isSuspicious: true,
        description: `Round number amount ($${amount.toFixed(2)}) may indicate fabricated receipt`,
        severity: 'low' as const
      };
    }

    return { isSuspicious: false, description: "", severity: 'low' as const };
  };

  // Vendor analysis
  const analyzeVendor = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]) => {
    const vendor = extractVendor(receipt);
    const userReceipts = allReceipts.filter(r => r.uploadedBy === receipt.uploadedBy && r.id !== receipt.id);
    
    if (userReceipts.length === 0) return { isSuspicious: false, description: "" };

    const userVendors = userReceipts.map(extractVendor).filter(v => v.length > 0);
    const vendorCounts = userVendors.reduce((acc, v) => {
      acc[v.toLowerCase()] = (acc[v.toLowerCase()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check if this is a new vendor for the user
    if (!vendorCounts[vendor.toLowerCase()]) {
      return {
        isSuspicious: true,
        description: `First-time vendor for this user: ${vendor}`
      };
    }

    // Check for suspicious vendor names
    const suspiciousKeywords = ['test', 'fake', 'sample', 'demo', 'temp'];
    if (suspiciousKeywords.some(keyword => vendor.toLowerCase().includes(keyword))) {
      return {
        isSuspicious: true,
        description: `Suspicious vendor name: ${vendor}`
      };
    }

    return { isSuspicious: false, description: "" };
  };

  // Timing analysis
  const analyzeTiming = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]) => {
    const receiptDate = new Date(receipt.uploadedAt);
    const userReceipts = allReceipts.filter(r => r.uploadedBy === receipt.uploadedBy && r.id !== receipt.id);
    
    if (userReceipts.length === 0) return { isSuspicious: false, description: "" };

    // Check for receipts submitted outside business hours
    const hour = receiptDate.getHours();
    if (hour < 6 || hour > 22) {
      return {
        isSuspicious: true,
        description: `Receipt submitted outside business hours (${hour}:00)`
      };
    }

    // Check for multiple receipts on the same day
    const sameDayReceipts = userReceipts.filter(r => {
      const rDate = new Date(r.uploadedAt);
      return rDate.toDateString() === receiptDate.toDateString();
    });

    if (sameDayReceipts.length >= 5) {
      return {
        isSuspicious: true,
        description: `User has submitted ${sameDayReceipts.length + 1} receipts on the same day`
      };
    }

    return { isSuspicious: false, description: "" };
  };

  // Spending pattern analysis
  const analyzeSpendingPatterns = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]) => {
    const userReceipts = allReceipts.filter(r => r.uploadedBy === receipt.uploadedBy && r.id !== receipt.id);
    
    if (userReceipts.length < 5) return { isSuspicious: false, description: "" };

    // Analyze spending frequency
    const receiptDates = userReceipts.map(r => new Date(r.uploadedAt)).sort();
    const timeBetweenReceipts = receiptDates.slice(1).map((date, i) => 
      date.getTime() - receiptDates[i].getTime()
    );
    
    const avgTimeBetween = timeBetweenReceipts.reduce((sum, time) => sum + time, 0) / timeBetweenReceipts.length;
    const currentTimeSinceLast = new Date(receipt.uploadedAt).getTime() - receiptDates[receiptDates.length - 1].getTime();

    // Check for unusually frequent submissions
    if (currentTimeSinceLast < avgTimeBetween / 3) {
      return {
        isSuspicious: true,
        description: `Unusually frequent receipt submission pattern detected`
      };
    }

    return { isSuspicious: false, description: "" };
  };

  // Helper functions
  const extractVendor = (receipt: ProcessedReceipt): string => {
    const vendorItem = receipt.items?.find(item => 
      item.label.toLowerCase().includes('vendor') || 
      item.label.toLowerCase().includes('merchant') ||
      item.label.toLowerCase().includes('store')
    );
    return vendorItem?.value || 'Unknown';
  };

  // Function to convert ProcessedReceipt to FraudAlert with real-time analysis
  const convertReceiptToAlert = (receipt: ProcessedReceipt, allReceipts: ProcessedReceipt[]): FraudAlert => {
    // Perform real-time fraud analysis
    const analysis = analyzeReceiptForFraud(receipt, allReceipts);

    // Get total amount from receipt
    const amount = getReceiptTotalAmount(receipt);
    const amountStr = amount > 0 ? `$${amount.toFixed(2)}` : 'N/A';

    // Get employee name from uploadedBy email
    const employee = receipt.uploadedBy.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return {
      id: receipt.id,
      receiptId: receipt.id,
      type: analysis.fraudType,
      severity: analysis.severity,
      description: analysis.description,
      employee,
      amount: amountStr,
      date: new Date(receipt.uploadedAt).toLocaleDateString(),
      status: receipt.status === 'pending_approval' ? 'pending' : 
              receipt.status === 'approved' ? 'resolved' : 
              receipt.status === 'rejected' ? 'rejected' : 'investigating',
      receiptImage: receipt.imageDataUri || receipt.imageUrl || '',
      fraudProbability: analysis.fraudProbability,
      uploadedBy: receipt.uploadedBy,
      supervisorId: receipt.supervisorId
    };
  };

  // Function to fetch fraudulent receipts with real-time analysis (for manager's team only)
  const fetchFraudAlerts = useCallback(async () => {
    if (!user?.id || user?.role !== 'manager') {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Initialize default users if needed (same as Team Dashboard)
      await initializeDefaultUsers();

      // Get team members - use same approach as Team Dashboard
      const teamMembers = await getEmployeesForManager(user.id);
      console.log('Manager Fraud Alerts - Team members:', teamMembers.length);

      // Get all receipts for the manager's team (by supervisorId)
      const receiptsBySupervisor = await getReceiptsForManager(user.id);
      console.log('Manager Fraud Alerts - Receipts by supervisorId:', receiptsBySupervisor.length);

      // Also get receipts by employee emails/IDs to catch any that might not have supervisorId set
      const { getReceiptsByUser } = await import('@/lib/firebase-receipt-store');
      const employeeReceiptPromises = teamMembers.map(emp => {
        if (emp.email) {
          return getReceiptsByUser(emp.email, user?.companyId);
        }
        return Promise.resolve([]);
      });
      const employeeReceiptsArrays = await Promise.all(employeeReceiptPromises);
      const receiptsByEmployee = employeeReceiptsArrays.flat();
      console.log('Manager Fraud Alerts - Receipts by employee emails:', receiptsByEmployee.length);

      // Combine and deduplicate receipts
      const receiptMap = new Map<string, ProcessedReceipt>();
      [...receiptsBySupervisor, ...receiptsByEmployee].forEach(receipt => {
        if (receipt.id) {
          receiptMap.set(receipt.id, receipt);
        }
      });
      const allReceipts = Array.from(receiptMap.values());
      console.log('Manager Fraud Alerts - Total unique receipts:', allReceipts.length);

      // Perform real-time fraud analysis on all team receipts
      // Only include receipts that require action (pending or investigating), not approved/rejected
      const fraudAlerts: FraudAlert[] = [];
      
      for (const receipt of allReceipts) {
        const analysis = analyzeReceiptForFraud(receipt, allReceipts);
        
        // Only include receipts that show fraud indicators AND require action
        if (analysis.isFraudulent) {
          // Only include if status is pending_approval or not yet resolved
          const status = receipt.status || 'pending_approval';
          if (status === 'pending_approval' || status === 'pending' || !['approved', 'rejected', 'resolved'].includes(status)) {
            const alert = convertReceiptToAlert(receipt, allReceipts);
            fraudAlerts.push(alert);
          }
        }
      }
      
      // Sort by fraud probability (highest first)
      fraudAlerts.sort((a, b) => b.fraudProbability - a.fraudProbability);
      
      setAlerts(fraudAlerts);
      console.log('Manager Fraud Alerts - Real-time analysis complete. Found', fraudAlerts.length, 'fraud alerts');

    } catch (error) {
      console.error('Error fetching fraud alerts:', error);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.role, user?.companyId]);

  // Load fraud alerts on component mount and when user changes
  useEffect(() => {
    if (user) {
      fetchFraudAlerts();
    }
  }, [user, fetchFraudAlerts]);

  const handleApprove = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, status: "resolved" } : alert
    ));
    alert(`Alert ${id} approved successfully!`);
  };

  const handleReject = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, status: "rejected" } : alert
    ));
    alert(`Alert ${id} rejected successfully!`);
  };

  const handleReview = (id: string) => {
    setSelectedAlert(id);
    setIsReviewModalOpen(true);
    setReviewNotes("");
    setIsImageZoomed(false);
  };

  const handleBulkAction = (action: string) => {
    const selectedAlerts = alerts.filter(alert => alert.status === "pending");
    if (selectedAlerts.length === 0) {
      alert("No pending alerts to process!");
      return;
    }
    
    if (action === "approve") {
      setAlerts(prev => prev.map(alert => 
        alert.status === "pending" ? { ...alert, status: "resolved" } : alert
      ));
      alert(`Approved ${selectedAlerts.length} alerts!`);
    } else if (action === "reject") {
      setAlerts(prev => prev.map(alert => 
        alert.status === "pending" ? { ...alert, status: "rejected" } : alert
      ));
      alert(`Rejected ${selectedAlerts.length} alerts!`);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-[var(--color-bg)] text-[var(--color-text)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-[var(--color-text-secondary)]">Loading fraud alerts...</p>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "investigating":
        return "secondary";
      case "resolved":
        return "outline";
      default:
        return "outline";
    }
  };

  const selectedAlertData = alerts.find(a => a.id === selectedAlert);

  return (
    <div className="space-y-6 p-6 bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Fraud Alerts</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">Monitor and manage fraud alerts for your team</p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant="destructive" className="px-3 py-1">
            <AlertTriangle className="h-4 w-4 mr-1" />
            {alerts.length} Active Alerts
          </Badge>
        </div>
      </div>

      {/* Real-Time Analysis Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">Real-time analysis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {alerts.filter(alert => alert.severity === 'high').length}
            </div>
            <p className="text-xs text-muted-foreground">Immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {alerts.filter(alert => alert.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analysis Types</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {new Set(alerts.map(alert => alert.type)).size}
            </div>
            <p className="text-xs text-muted-foreground">Fraud patterns detected</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>Process multiple alerts at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button 
              onClick={() => handleBulkAction("approve")}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve All Pending
            </Button>
            <Button 
              onClick={() => handleBulkAction("reject")}
              variant="destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject All Pending
            </Button>
            <Button 
              onClick={fetchFraudAlerts}
              variant="outline"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                'Refresh Data'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-600" />
            Real-Time Fraud Analysis
          </CardTitle>
          <CardDescription>
            Advanced fraud detection analyzing your team's receipt data patterns, amounts, vendors, and timing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">No Fraud Detected</h3>
              <p className="text-[var(--color-text-secondary)] mb-4">
                Real-time analysis of your team's receipt data shows no suspicious patterns. All receipts appear legitimate.
              </p>
              <div className="text-sm text-[var(--color-text-secondary)] mb-4">
                Analysis includes: duplicate detection, amount anomalies, vendor patterns, timing analysis, and spending behavior
              </div>
              <Button onClick={fetchFraudAlerts} variant="outline" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  'Re-analyze Data'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors bg-[var(--color-card)]">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-[var(--color-text)]">{alert.type}</h3>
                      <Badge variant={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                      <Badge variant={getStatusColor(alert.status)}>
                        {alert.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">{alert.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-[var(--color-text-secondary)]">
                      <span>Employee: {alert.employee}</span>
                      <span>Amount: {alert.amount}</span>
                      <span>Date: {alert.date}</span>
                      <span>Probability: {(alert.fraudProbability * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReview(alert.id)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Review
                  </Button>
                  {alert.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApprove(alert.id)}
                        className="bg-green-50 hover:bg-green-100"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(alert.id)}
                        className="bg-red-50 hover:bg-red-100"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Fraud Alert</DialogTitle>
            <DialogDescription>
              Review the details and evidence for this fraud alert
            </DialogDescription>
          </DialogHeader>
          {selectedAlertData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Alert Type</Label>
                  <p className="font-medium">{selectedAlertData.type}</p>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Badge variant={getSeverityColor(selectedAlertData.severity)}>
                    {selectedAlertData.severity}
                  </Badge>
                </div>
                <div>
                  <Label>Employee</Label>
                  <p className="font-medium">{selectedAlertData.employee}</p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="font-medium">{selectedAlertData.amount}</p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="font-medium">{selectedAlertData.date}</p>
                </div>
                <div>
                  <Label>Fraud Probability</Label>
                  <p className="font-medium">{(selectedAlertData.fraudProbability * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <p className="text-sm text-[var(--color-text-secondary)]">{selectedAlertData.description}</p>
              </div>
              {selectedAlertData.receiptImage && (
                <div>
                  <Label>Receipt Image</Label>
                  <div className="mt-2 relative">
                    <Image
                      src={selectedAlertData.receiptImage}
                      alt="Receipt"
                      width={600}
                      height={800}
                      className="rounded-lg border"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setIsImageZoomed(!isImageZoomed)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <Label>Review Notes</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add your review notes here..."
                  className="mt-2"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(selectedAlertData.id);
                    setIsReviewModalOpen(false);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleReject(selectedAlertData.id);
                    setIsReviewModalOpen(false);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

