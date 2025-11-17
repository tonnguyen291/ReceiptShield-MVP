"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, TrendingUp, AlertTriangle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getEmployeesForManager, initializeDefaultUsers } from "@/lib/firebase-user-store";
import { getReceiptsForManager } from "@/lib/receipt-store";
import { getReceiptTotalAmount } from "@/lib/data-service";
import type { ProcessedReceipt } from "@/types";

interface TeamSpendingData {
  employee: string;
  amount: number;
  receipts: number;
  status: string;
}

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export default function ManagerAnalyticsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [teamData, setTeamData] = useState({
    totalTeamMembers: 0,
    activeSubmissions: 0,
    pendingApprovals: 0,
    totalTeamSpending: 0,
    averagePerEmployee: 0,
    topSpender: "",
    mostCommonCategory: "",
    fraudAlerts: 0
  });

  const [teamSpending, setTeamSpending] = useState<TeamSpendingData[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryData[]>([]);

  useEffect(() => {
    const loadData = async () => {
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
        console.log('Team Analytics - Team members:', teamMembers.length, teamMembers.map(m => ({ id: m.id, email: m.email, name: m.name })));
        
        // Get all receipts for the manager's team (by supervisorId)
        const receiptsBySupervisor = await getReceiptsForManager(user.id);
        console.log('Team Analytics - Receipts by supervisorId:', receiptsBySupervisor.length);
        
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
        console.log('Team Analytics - Receipts by employee emails:', receiptsByEmployee.length);
        
        // Combine and deduplicate receipts
        const receiptMap = new Map<string, ProcessedReceipt>();
        [...receiptsBySupervisor, ...receiptsByEmployee].forEach(receipt => {
          if (receipt.id) {
            receiptMap.set(receipt.id, receipt);
          }
        });
        const allReceipts = Array.from(receiptMap.values());
        console.log('Team Analytics - Total unique receipts:', allReceipts.length);
        
        if (allReceipts.length > 0) {
          console.log('Team Analytics - Sample receipts:', allReceipts.slice(0, 3).map(r => ({
            id: r.id,
            uploadedBy: r.uploadedBy,
            itemsCount: r.items?.length || 0
          })));
        }

        // Use all receipts (all-time) to match manager dashboard, not just current month
        // Calculate team spending by employee
        const employeeSpendingMap: { [email: string]: { amount: number; receipts: number; status: string } } = {};
        
        for (const member of teamMembers) {
          const memberReceipts = allReceipts.filter(r => 
            r.uploadedBy === member.email || r.uploadedBy === member.id
          );
          
          if (memberReceipts.length > 0) {
            console.log(`Team Analytics - ${member.name || member.email}: ${memberReceipts.length} receipts`);
          }
          
          // Calculate all-time total for this employee
          const totalAmount = memberReceipts.reduce((sum, receipt) => {
            return sum + getReceiptTotalAmount(receipt);
          }, 0);

          // Determine status (if has pending, show pending, else show approved)
          const hasPending = memberReceipts.some(r => r.status === 'pending_approval');
          const hasRejected = memberReceipts.some(r => r.status === 'rejected');
          
          let status = "approved";
          if (hasPending) status = "pending";
          else if (hasRejected) status = "rejected";

          employeeSpendingMap[member.email || member.id] = {
            amount: totalAmount,
            receipts: memberReceipts.length,
            status
          };
        }

        const teamSpendingData: TeamSpendingData[] = teamMembers.map(member => ({
          employee: member.name || member.email || 'Unknown',
          amount: employeeSpendingMap[member.email || member.id]?.amount || 0,
          receipts: employeeSpendingMap[member.email || member.id]?.receipts || 0,
          status: employeeSpendingMap[member.email || member.id]?.status || 'approved'
        })).sort((a, b) => b.amount - a.amount);

        // Calculate category breakdown using same logic as getUserSpendingAnalytics
        const categoryMap: { [category: string]: { amount: number; count: number } } = {};
        
        const categorizeByMerchant = (merchant: string): string => {
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
        };
        
        // Use all receipts for category breakdown (all-time)
        allReceipts.forEach(receipt => {
          // Category logic - derive from receipt items or use default
          let category = 'Other';
          // Try to categorize based on item labels
          if (receipt.items && receipt.items.length > 0) {
            const firstItem = receipt.items[0];
            if (firstItem.label) {
              category = categorizeByMerchant(firstItem.label);
            }
          }
          
          const amount = getReceiptTotalAmount(receipt);
          
          if (!categoryMap[category]) {
            categoryMap[category] = { amount: 0, count: 0 };
          }
          categoryMap[category].amount += amount;
          categoryMap[category].count += 1;
        });

        const totalCategoryAmount = Object.values(categoryMap).reduce((sum, cat) => sum + cat.amount, 0);
        const categoryData: CategoryData[] = Object.entries(categoryMap)
          .map(([category, data]) => ({
            category,
            amount: data.amount,
            percentage: totalCategoryAmount > 0 ? (data.amount / totalCategoryAmount) * 100 : 0,
            count: data.count
          }))
          .sort((a, b) => b.amount - a.amount);

        // Calculate summary statistics (all-time, not just current month)
        const totalTeamSpending = allReceipts.reduce((sum, receipt) => {
          return sum + getReceiptTotalAmount(receipt);
        }, 0);

        const pendingApprovals = allReceipts.filter(r => r.status === 'pending_approval').length;
        const fraudAlerts = allReceipts.filter(r => r.isFraudulent).length;
        const topSpender = teamSpendingData.length > 0 ? teamSpendingData[0].employee : "";
        const mostCommonCategory = categoryData.length > 0 ? categoryData[0].category : "";

        setTeamData({
          totalTeamMembers: teamMembers.length,
          activeSubmissions: allReceipts.length,
          pendingApprovals,
          totalTeamSpending,
          averagePerEmployee: teamMembers.length > 0 ? totalTeamSpending / teamMembers.length : 0,
          topSpender,
          mostCommonCategory,
          fraudAlerts
        });

        setTeamSpending(teamSpendingData);
        setCategoryBreakdown(categoryData);

      } catch (error) {
        console.error('Error loading team analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id, user?.role]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "pending":
        return "secondary";
      case "rejected":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "rejected":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Analytics</h1>
        <p className="text-gray-600 mt-2">Comprehensive insights into your team's expense patterns and performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamData.totalTeamMembers}</div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${teamData.totalTeamSpending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{teamData.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">Requires review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{teamData.fraudAlerts}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Spending Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Spending by Employee</CardTitle>
            <CardDescription>Individual spending breakdown for your team</CardDescription>
          </CardHeader>
          <CardContent>
            {teamSpending.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No team spending data available</p>
              </div>
            ) : (
            <div className="space-y-4">
              {teamSpending.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {member.employee.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{member.employee}</div>
                      <div className="text-sm text-gray-500">{member.receipts} receipts</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="font-bold">${member.amount.toLocaleString()}</div>
                    </div>
                    <Badge variant={getStatusColor(member.status)}>
                      {getStatusIcon(member.status)}
                      <span className="ml-1 capitalize">{member.status}</span>
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Team expenses broken down by category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No category data available</p>
              </div>
            ) : (
            <div className="space-y-4">
              {categoryBreakdown.map((category, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{category.category}</span>
                    <div className="text-right">
                      <div className="font-bold">${category.amount.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">{category.percentage}%</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${category.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-500">{category.count} transactions</div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Insights</CardTitle>
          <CardDescription>Key insights and recommendations for your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Spending Trend</h3>
              <p className="text-sm text-gray-600">Team spending increased by 12% this month</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Top Performer</h3>
              <p className="text-sm text-gray-600">{teamData.topSpender} has the highest spending</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <DollarSign className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Average per Employee</h3>
              <p className="text-sm text-gray-600">${teamData.averagePerEmployee.toFixed(2)} per person</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}