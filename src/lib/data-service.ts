"use client";

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type { User, ProcessedReceipt, ReceiptSubmission } from '@/types';

// ==================== USER DATA ====================

export async function getCurrentUser(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userDoc.id,
        ...userData,
        createdAt: userData.createdAt?.toDate(),
        updatedAt: userData.updatedAt?.toDate()
      } as User;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as User[];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function getUsersByRole(role: string): Promise<User[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', role),
      where('status', '==', 'active')
    );
    const usersSnapshot = await getDocs(q);
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as User[];
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }
}

export async function getTeamMembers(managerId: string): Promise<User[]> {
  try {
    const q = query(
      collection(db, 'users'),
      where('supervisorId', '==', managerId),
      where('status', '==', 'active')
    );
    const usersSnapshot = await getDocs(q);
    return usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    })) as User[];
  } catch (error) {
    console.error('Error fetching team members:', error);
    return [];
  }
}

// ==================== RECEIPT DATA ====================

export async function getUserReceipts(userEmail: string): Promise<ProcessedReceipt[]> {
  try {
    const q = query(
      collection(db, 'receipts'),
      where('uploadedBy', '==', userEmail),
      orderBy('uploadedAt', 'desc')
    );
    const receiptsSnapshot = await getDocs(q);
    return receiptsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt,
      createdAt: doc.data().createdAt,
      updatedAt: doc.data().updatedAt
    })) as ProcessedReceipt[];
  } catch (error) {
    console.error('Error fetching user receipts:', error);
    return [];
  }
}

export async function getTeamReceipts(teamEmails: string[]): Promise<ProcessedReceipt[]> {
  try {
    const receipts: ProcessedReceipt[] = [];
    
    // Firestore doesn't support 'in' queries with more than 10 items
    const chunks = [];
    for (let i = 0; i < teamEmails.length; i += 10) {
      chunks.push(teamEmails.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
      const q = query(
        collection(db, 'receipts'),
        where('uploadedBy', 'in', chunk),
        orderBy('uploadedAt', 'desc')
      );
      const receiptsSnapshot = await getDocs(q);
      const chunkReceipts = receiptsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt,
        createdAt: doc.data().createdAt,
        updatedAt: doc.data().updatedAt
      })) as ProcessedReceipt[];
      receipts.push(...chunkReceipts);
    }
    
    return receipts.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  } catch (error) {
    console.error('Error fetching team receipts:', error);
    return [];
  }
}

export async function getAllReceipts(): Promise<ProcessedReceipt[]> {
  try {
    const q = query(
      collection(db, 'receipts'),
      orderBy('uploadedAt', 'desc')
    );
    const receiptsSnapshot = await getDocs(q);
    return receiptsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt,
      createdAt: doc.data().createdAt,
      updatedAt: doc.data().updatedAt
    })) as ProcessedReceipt[];
  } catch (error) {
    console.error('Error fetching all receipts:', error);
    return [];
  }
}

// ==================== ANALYTICS DATA ====================

export interface SpendingAnalytics {
  totalSpent: number;
  totalReceipts: number;
  averagePerReceipt: number;
  spendingByCategory: { [category: string]: number };
  monthlyTrends: { month: string; amount: number }[];
  recentReceipts: ProcessedReceipt[];
  statusBreakdown: { status: string; count: number; amount: number }[];
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  userVsAverage: { userSpent: number; averageSpent: number; period: string };
}

// Helper function to extract total amount from receipt items (same logic as receipts page)
export function getReceiptTotalAmount(receipt: ProcessedReceipt): number {
  const amountItem = receipt.items?.find(i => 
    i.label.toLowerCase().includes('total amount') || 
    i.label.toLowerCase().includes('amount') ||
    (i.label.toLowerCase().includes('total') && !i.label.toLowerCase().includes('tax'))
  );
  if (!amountItem) return 0;
  const amountValue = parseFloat(amountItem.value.replace(/[^0-9.-]+/g, "") || "0");
  return isNaN(amountValue) ? 0 : amountValue;
}

export async function getUserSpendingAnalytics(userEmail: string): Promise<SpendingAnalytics> {
  try {
    const receipts = await getUserReceipts(userEmail);
    
    // Calculate total spent - only use the "Total Amount" field, not sum all items
    const totalSpent = receipts.reduce((sum, receipt) => {
      return sum + getReceiptTotalAmount(receipt);
    }, 0);
    
    // Enhanced category breakdown using receipt category or merchant
    const spendingByCategory: { [category: string]: number } = {};
    const statusBreakdown: { [status: string]: { count: number; amount: number } } = {};
    
    receipts.forEach(receipt => {
      // Category logic - derive from receipt items or use default
      let category = 'Other';
      // Try to categorize based on item labels
      if (receipt.items.length > 0) {
        const firstItem = receipt.items[0];
        if (firstItem.label) {
          category = categorizeByMerchant(firstItem.label);
        }
      }
      
      // Use the total amount field, not sum of all items
      const amount = getReceiptTotalAmount(receipt);
      
      spendingByCategory[category] = (spendingByCategory[category] || 0) + amount;
      
      // Status breakdown
      const status = receipt.status || 'pending';
      if (!statusBreakdown[status]) {
        statusBreakdown[status] = { count: 0, amount: 0 };
      }
      statusBreakdown[status].count += 1;
      statusBreakdown[status].amount += amount;
    });
    
    // Convert spending by category to percentage
    const categoryBreakdown = Object.entries(spendingByCategory).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
    
    // Convert status breakdown to array
    const statusBreakdownArray = Object.entries(statusBreakdown).map(([status, data]) => {
      // Format status: "pending_approval" -> "Pending Approval", "approved" -> "Approved"
      const formattedStatus = status
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      return {
        status: formattedStatus,
        count: data.count,
        amount: data.amount
      };
    });
    
    // Generate monthly trends (last 6 months)
    const monthlyTrends = generateMonthlyTrends(receipts);
    
    // Get user vs average comparison (current month)
    const userVsAverage = await getUserVsAverageComparison(userEmail, receipts);
    
    return {
      totalSpent,
      totalReceipts: receipts.length,
      averagePerReceipt: receipts.length > 0 ? totalSpent / receipts.length : 0,
      spendingByCategory,
      monthlyTrends,
      recentReceipts: receipts.slice(0, 5),
      statusBreakdown: statusBreakdownArray,
      categoryBreakdown,
      userVsAverage
    };
  } catch (error) {
    console.error('Error generating user analytics:', error);
    return {
      totalSpent: 0,
      totalReceipts: 0,
      averagePerReceipt: 0,
      spendingByCategory: {},
      monthlyTrends: [],
      recentReceipts: [],
      statusBreakdown: [],
      categoryBreakdown: [],
      userVsAverage: { userSpent: 0, averageSpent: 0, period: 'current_month' }
    };
  }
}

export async function getTeamSpendingAnalytics(teamEmails: string[]): Promise<SpendingAnalytics> {
  try {
    const receipts = await getTeamReceipts(teamEmails);
    
    // Calculate total spent - only use the "Total Amount" field, not sum all items
    const totalSpent = receipts.reduce((sum, receipt) => {
      return sum + getReceiptTotalAmount(receipt);
    }, 0);
    
    const spendingByCategory: { [category: string]: number } = {};
    receipts.forEach(receipt => {
      // Use the total amount field, not sum of all items
      const amount = getReceiptTotalAmount(receipt);
      const category = 'Other'; // Default category since ReceiptDataItem doesn't have category
      spendingByCategory[category] = (spendingByCategory[category] || 0) + amount;
    });
    
    const monthlyTrends = generateMonthlyTrends(receipts);
    
    return {
      totalSpent,
      totalReceipts: receipts.length,
      averagePerReceipt: receipts.length > 0 ? totalSpent / receipts.length : 0,
      spendingByCategory,
      monthlyTrends,
      recentReceipts: receipts.slice(0, 10),
      statusBreakdown: [],
      categoryBreakdown: [],
      userVsAverage: { userSpent: 0, averageSpent: 0, period: 'current_month' }
    };
  } catch (error) {
    console.error('Error generating team analytics:', error);
    return {
      totalSpent: 0,
      totalReceipts: 0,
      averagePerReceipt: 0,
      spendingByCategory: {},
      monthlyTrends: [],
      recentReceipts: [],
      statusBreakdown: [],
      categoryBreakdown: [],
      userVsAverage: { userSpent: 0, averageSpent: 0, period: 'current_month' }
    };
  }
}

export async function getOrganizationAnalytics(): Promise<SpendingAnalytics> {
  try {
    const receipts = await getAllReceipts();
    
    // Calculate total spent - only use the "Total Amount" field, not sum all items
    const totalSpent = receipts.reduce((sum, receipt) => {
      return sum + getReceiptTotalAmount(receipt);
    }, 0);
    
    const spendingByCategory: { [category: string]: number } = {};
    receipts.forEach(receipt => {
      // Use the total amount field, not sum of all items
      const amount = getReceiptTotalAmount(receipt);
      const category = 'Other'; // Default category since ReceiptDataItem doesn't have category
      spendingByCategory[category] = (spendingByCategory[category] || 0) + amount;
    });
    
    const monthlyTrends = generateMonthlyTrends(receipts);
    
    return {
      totalSpent,
      totalReceipts: receipts.length,
      averagePerReceipt: receipts.length > 0 ? totalSpent / receipts.length : 0,
      spendingByCategory,
      monthlyTrends,
      recentReceipts: receipts.slice(0, 20),
      statusBreakdown: [],
      categoryBreakdown: [],
      userVsAverage: { userSpent: 0, averageSpent: 0, period: 'current_month' }
    };
  } catch (error) {
    console.error('Error generating organization analytics:', error);
    return {
      totalSpent: 0,
      totalReceipts: 0,
      averagePerReceipt: 0,
      spendingByCategory: {},
      monthlyTrends: [],
      recentReceipts: [],
      statusBreakdown: [],
      categoryBreakdown: [],
      userVsAverage: { userSpent: 0, averageSpent: 0, period: 'current_month' }
    };
  }
}

// ==================== MANAGER ANALYTICS ====================

export interface ManagerAnalytics {
  departmentSpend: { department: string; amount: number; count: number }[];
  employeeLeaderboard: { employee: string; amount: number; count: number; department: string }[];
  vendorAnalysis: { vendor: string; amount: number; percentage: number; cumulativePercentage: number }[];
  departmentTrends: { month: string; [department: string]: string | number }[];
  fraudOutliers: { employee: string; department: string; amount: number; isOutlier: boolean; zScore: number }[];
  submissionTiming: { day: string; employee: string; count: number; amount: number }[];
}

export async function getManagerAnalytics(managerId: string, companyId?: string): Promise<ManagerAnalytics> {
  try {
    if (!managerId) {
      throw new Error('Manager ID is required');
    }

    // Get the manager's team members to filter receipts correctly
    const { getEmployeesForManager } = await import('./firebase-user-store');
    const teamMembers = await getEmployeesForManager(managerId, companyId);
    const teamMemberEmails = new Set(teamMembers.map(m => m.email).filter(Boolean));
    const teamMemberIds = new Set(teamMembers.map(m => m.id).filter(Boolean));
    
    // Get receipts for the manager's team using getReceiptsForManager (filters by supervisorId)
    const { getReceiptsForManager } = await import('./receipt-store');
    const allReceipts = await getReceiptsForManager(managerId);
    
    // Filter receipts to only those from the manager's team members (by email or ID)
    // This ensures we only show employees that actually belong to this manager
    const teamReceipts = allReceipts.filter(receipt => {
      // Include receipts uploaded by team members
      return teamMemberEmails.has(receipt.uploadedBy) || 
             teamMemberIds.has(receipt.uploadedBy) ||
             receipt.supervisorId === managerId;
    });

    // Department Spend Analysis
    const departmentSpend = await getDepartmentSpendAnalysis(teamReceipts);
    
    // Employee Leaderboard
    const employeeLeaderboard = await getEmployeeLeaderboard(teamReceipts);
    
    // Vendor Analysis
    const vendorAnalysis = await getVendorAnalysis(teamReceipts);
    
    // Department Trends
    const departmentTrends = await getDepartmentTrends(teamReceipts);
    
    // Fraud & Outliers
    const fraudOutliers = await getFraudOutliers(teamReceipts);
    
    // Submission Timing
    const submissionTiming = await getSubmissionTiming(teamReceipts);

    return {
      departmentSpend,
      employeeLeaderboard,
      vendorAnalysis,
      departmentTrends,
      fraudOutliers,
      submissionTiming
    };
  } catch (error) {
    console.error('Error generating manager analytics:', error);
    return {
      departmentSpend: [],
      employeeLeaderboard: [],
      vendorAnalysis: [],
      departmentTrends: [],
      fraudOutliers: [],
      submissionTiming: []
    };
  }
}

async function getDepartmentSpendAnalysis(receipts: ProcessedReceipt[]): Promise<{ department: string; amount: number; count: number }[]> {
  const departmentMap: { [key: string]: { amount: number; count: number } } = {};
  
  receipts.forEach(receipt => {
    if (!receipt.uploadedBy || !receipt.items || !Array.isArray(receipt.items)) {
      return; // Skip invalid receipts
    }

    // Extract department from email domain or use supervisor info
    const department = extractDepartmentFromEmail(receipt.uploadedBy);
    // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
    const amount = getReceiptTotalAmount(receipt);
    
    if (!departmentMap[department]) {
      departmentMap[department] = { amount: 0, count: 0 };
    }
    departmentMap[department].amount += amount;
    departmentMap[department].count += 1;
  });
  
  return Object.entries(departmentMap).map(([department, data]) => ({
    department,
    amount: data.amount,
    count: data.count
  })).sort((a, b) => b.amount - a.amount);
}

async function getEmployeeLeaderboard(receipts: ProcessedReceipt[]): Promise<{ employee: string; amount: number; count: number; department: string }[]> {
  const employeeMap: { [key: string]: { amount: number; count: number; department: string } } = {};
  
  receipts.forEach(receipt => {
    if (!receipt.uploadedBy || !receipt.items || !Array.isArray(receipt.items)) {
      return; // Skip invalid receipts
    }

    const employee = receipt.uploadedBy;
    const department = extractDepartmentFromEmail(receipt.uploadedBy);
    // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
    const amount = getReceiptTotalAmount(receipt);
    
    if (!employeeMap[employee]) {
      employeeMap[employee] = { amount: 0, count: 0, department };
    }
    employeeMap[employee].amount += amount;
    employeeMap[employee].count += 1;
  });
  
  return Object.entries(employeeMap).map(([employee, data]) => ({
    employee: employee.split('@')[0], // Remove email domain for display
    amount: data.amount,
    count: data.count,
    department: data.department
  })).sort((a, b) => b.amount - a.amount).slice(0, 10); // Top 10 employees
}

async function getVendorAnalysis(receipts: ProcessedReceipt[]): Promise<{ vendor: string; amount: number; percentage: number; cumulativePercentage: number }[]> {
  const vendorMap: { [key: string]: number } = {};
  
  receipts.forEach(receipt => {
    // Extract vendor from receipt items or use a default
    const vendor = receipt.items[0]?.label || 'Unknown Vendor';
    // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
    const amount = getReceiptTotalAmount(receipt);
    
    vendorMap[vendor] = (vendorMap[vendor] || 0) + amount;
  });
  
  const totalAmount = Object.values(vendorMap).reduce((sum, amount) => sum + amount, 0);
  const sortedVendors = Object.entries(vendorMap)
    .map(([vendor, amount]) => ({
      vendor,
      amount,
      percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);
  
  // Calculate cumulative percentage
  let cumulativePercentage = 0;
  return sortedVendors.map(vendor => {
    cumulativePercentage += vendor.percentage;
    return {
      ...vendor,
      cumulativePercentage
    };
  });
}

async function getDepartmentTrends(receipts: ProcessedReceipt[]): Promise<{ month: string; [department: string]: string | number }[]> {
  const monthlyData: { [month: string]: { [department: string]: number } } = {};
  
  receipts.forEach(receipt => {
    const date = new Date(receipt.uploadedAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const department = extractDepartmentFromEmail(receipt.uploadedBy);
    // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
    const amount = getReceiptTotalAmount(receipt);
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {};
    }
    monthlyData[monthKey][department] = (monthlyData[monthKey][department] || 0) + amount;
  });
  
  // Get all unique departments
  const allDepartments = new Set<string>();
  Object.values(monthlyData).forEach(monthData => {
    Object.keys(monthData).forEach(dept => allDepartments.add(dept));
  });
  
  return Object.entries(monthlyData).map(([month, departmentData]) => {
    const result: { month: string; [department: string]: string | number } = { month };
    allDepartments.forEach(dept => {
      result[dept] = departmentData[dept] || 0;
    });
    return result;
  }).sort((a, b) => a.month.localeCompare(b.month));
}

async function getFraudOutliers(receipts: ProcessedReceipt[]): Promise<{ employee: string; department: string; amount: number; isOutlier: boolean; zScore: number }[]> {
  const employeeSpending: { [employee: string]: number[] } = {};
  
  receipts.forEach(receipt => {
    const employee = receipt.uploadedBy;
    // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
    const amount = getReceiptTotalAmount(receipt);
    
    if (!employeeSpending[employee]) {
      employeeSpending[employee] = [];
    }
    employeeSpending[employee].push(amount);
  });
  
  // Calculate statistics for outlier detection
  const allAmounts = Object.values(employeeSpending).flat();
  if (allAmounts.length === 0) return [];
  
  const mean = allAmounts.reduce((sum, amount) => sum + amount, 0) / allAmounts.length;
  const variance = allAmounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / allAmounts.length;
  const stdDev = Math.sqrt(variance);
  
  return Object.entries(employeeSpending).map(([employee, amounts]) => {
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
    const zScore = stdDev > 0 ? (totalAmount - mean) / stdDev : 0;
    const isOutlier = Math.abs(zScore) > 2; // Z-score > 2 is considered outlier
    
    return {
      employee: employee.split('@')[0],
      department: extractDepartmentFromEmail(employee),
      amount: totalAmount,
      isOutlier,
      zScore
    };
  }).sort((a, b) => b.amount - a.amount);
}

async function getSubmissionTiming(receipts: ProcessedReceipt[]): Promise<{ day: string; employee: string; count: number; amount: number }[]> {
  const timingData: { [key: string]: { count: number; amount: number } } = {};
  
  receipts.forEach(receipt => {
    const date = new Date(receipt.uploadedAt);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const employee = receipt.uploadedBy.split('@')[0];
    const key = `${dayOfWeek}-${employee}`;
    // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
    const amount = getReceiptTotalAmount(receipt);
    
    if (!timingData[key]) {
      timingData[key] = { count: 0, amount: 0 };
    }
    timingData[key].count += 1;
    timingData[key].amount += amount;
  });
  
  return Object.entries(timingData).map(([key, data]) => {
    const [day, employee] = key.split('-');
    return {
      day,
      employee,
      count: data.count,
      amount: data.amount
    };
  });
}

function extractDepartmentFromEmail(email: string): string {
  // Simple department extraction based on email patterns
  if (email.includes('sales')) return 'Sales';
  if (email.includes('marketing')) return 'Marketing';
  if (email.includes('engineering') || email.includes('dev')) return 'Engineering';
  if (email.includes('hr') || email.includes('human')) return 'Human Resources';
  if (email.includes('finance') || email.includes('accounting')) return 'Finance';
  if (email.includes('admin') || email.includes('support')) return 'Administration';
  return 'General';
}

// ==================== HELPER FUNCTIONS ====================

// Helper function to categorize receipts by merchant name
function categorizeByMerchant(merchant: string): string {
  const merchantLower = merchant.toLowerCase();
  
  // Food & Dining
  if (merchantLower.includes('restaurant') || merchantLower.includes('cafe') || 
      merchantLower.includes('coffee') || merchantLower.includes('food') ||
      merchantLower.includes('starbucks') || merchantLower.includes('mcdonald') ||
      merchantLower.includes('pizza') || merchantLower.includes('burger')) {
    return 'Food & Dining';
  }
  
  // Travel
  if (merchantLower.includes('hotel') || merchantLower.includes('airline') ||
      merchantLower.includes('taxi') || merchantLower.includes('uber') ||
      merchantLower.includes('lyft') || merchantLower.includes('flight') ||
      merchantLower.includes('travel') || merchantLower.includes('booking')) {
    return 'Travel';
  }
  
  // Office Supplies
  if (merchantLower.includes('office') || merchantLower.includes('supplies') ||
      merchantLower.includes('staples') || merchantLower.includes('depot') ||
      merchantLower.includes('amazon') || merchantLower.includes('dell') ||
      merchantLower.includes('computer') || merchantLower.includes('laptop')) {
    return 'Office Supplies';
  }
  
  // Transportation
  if (merchantLower.includes('gas') || merchantLower.includes('fuel') ||
      merchantLower.includes('shell') || merchantLower.includes('exxon') ||
      merchantLower.includes('chevron') || merchantLower.includes('bp')) {
    return 'Transportation';
  }
  
  // Entertainment
  if (merchantLower.includes('movie') || merchantLower.includes('cinema') ||
      merchantLower.includes('theater') || merchantLower.includes('entertainment') ||
      merchantLower.includes('netflix') || merchantLower.includes('spotify')) {
    return 'Entertainment';
  }
  
  return 'Other';
}

// Helper function to get user vs average comparison
async function getUserVsAverageComparison(userEmail: string, userReceipts: ProcessedReceipt[]): Promise<{ userSpent: number; averageSpent: number; period: string }> {
  try {
    // Calculate user's all-time spending (to match Total Amount card)
    const userTotalSpent = userReceipts.reduce((sum, receipt) => {
      return sum + getReceiptTotalAmount(receipt);
    }, 0);
    
    // Get all receipts to calculate average (all-time)
    const allReceipts = await getAllReceipts();
    
    // Group by user and calculate average (all-time)
    const userSpendingMap: { [email: string]: number } = {};
    allReceipts.forEach(receipt => {
      const email = receipt.uploadedBy;
      if (email) {
        const amount = getReceiptTotalAmount(receipt);
        userSpendingMap[email] = (userSpendingMap[email] || 0) + amount;
      }
    });
    
    const userSpendingArray = Object.values(userSpendingMap);
    const averageSpent = userSpendingArray.length > 0 
      ? userSpendingArray.reduce((sum, amount) => sum + amount, 0) / userSpendingArray.length 
      : 0;
    
    return {
      userSpent: userTotalSpent,
      averageSpent,
      period: 'all_time'
    };
  } catch (error) {
    console.error('Error calculating user vs average:', error);
    return {
      userSpent: 0,
      averageSpent: 0,
      period: 'all_time'
    };
  }
}

function generateMonthlyTrends(receipts: ProcessedReceipt[]): { month: string; amount: number }[] {
  const monthlyData: { [key: string]: number } = {};
  
  receipts.forEach(receipt => {
    const date = new Date(receipt.uploadedAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    // Use the total amount field, not sum of all items
    const receiptTotal = getReceiptTotalAmount(receipt);
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + receiptTotal;
  });
  
  // Generate last 6 months
  const trends = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    trends.push({
      month: monthKey, // Return in "YYYY-MM" format for proper date formatting
      amount: monthlyData[monthKey] || 0
    });
  }
  
  return trends;
}

// ==================== SUBMISSION DATA ====================

export async function getUserSubmissions(userId: string): Promise<ReceiptSubmission[]> {
  try {
    const q = query(
      collection(db, 'receipt_submissions'),
      where('userUid', '==', userId),
      orderBy('submittedAt', 'desc')
    );
    const submissionsSnapshot = await getDocs(q);
    return submissionsSnapshot.docs.map(doc => ({
      submissionId: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt,
      processedAt: doc.data().processedAt,
      analyzedAt: doc.data().analyzedAt
    })) as ReceiptSubmission[];
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    return [];
  }
}

export async function getPendingApprovals(managerId: string): Promise<ProcessedReceipt[]> {
  try {
    const q = query(
      collection(db, 'receipts'),
      where('supervisorId', '==', managerId),
      where('status', '==', 'pending_approval'),
      orderBy('uploadedAt', 'desc')
    );
    const receiptsSnapshot = await getDocs(q);
    return receiptsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt,
      createdAt: doc.data().createdAt,
      updatedAt: doc.data().updatedAt
    })) as ProcessedReceipt[];
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return [];
  }
}
