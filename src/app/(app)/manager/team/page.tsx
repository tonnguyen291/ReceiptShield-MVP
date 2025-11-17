"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, DollarSign, Receipt, Clock, CheckCircle, AlertTriangle, Mail, Phone, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getEmployeesForManager } from "@/lib/firebase-user-store";
import { getReceiptsForManager } from "@/lib/receipt-store";
import { getReceiptTotalAmount } from "@/lib/data-service";
import { format } from "date-fns";
import type { ProcessedReceipt } from "@/types";

interface TeamMemberData {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  totalSpending: number;
  receipts: number;
  status: string;
  lastSubmission: string;
  pendingApprovals: number;
}

export default function ManagerTeamPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [teamStats, setTeamStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalSpending: 0,
    averagePerMember: 0,
    pendingApprovals: 0,
    fraudAlerts: 0,
    totalReceipts: 0
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        console.log('Manager Team Page - No user ID:', user);
        setIsLoading(false);
        return;
      }

      if (!user?.companyId) {
        console.log('Manager Team Page - No companyId:', user);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        console.log('Manager Team Page - Loading data for manager:', {
          managerId: user.id,
          companyId: user.companyId,
          userEmail: user.email
        });

        // Get team members
        const employees = await getEmployeesForManager(user.id, user.companyId);
        console.log('Manager Team Page - Employees fetched:', employees.length, employees);
        
        // Get all receipts for the manager's team (by supervisorId)
        const receiptsBySupervisor = await getReceiptsForManager(user.id);
        console.log('Manager Team Page - Receipts by supervisorId:', receiptsBySupervisor.length);
        
        // Also get receipts by employee emails/IDs to catch any that might not have supervisorId set
        const { getReceiptsByUser } = await import('@/lib/firebase-receipt-store');
        const employeeReceiptPromises = employees.map(emp => {
          if (emp.email) {
            return getReceiptsByUser(emp.email, user.companyId);
          }
          return Promise.resolve([]);
        });
        const employeeReceiptsArrays = await Promise.all(employeeReceiptPromises);
        const receiptsByEmployee = employeeReceiptsArrays.flat();
        console.log('Manager Team Page - Receipts by employee emails:', receiptsByEmployee.length);
        
        // Combine and deduplicate receipts
        const receiptMap = new Map<string, ProcessedReceipt>();
        [...receiptsBySupervisor, ...receiptsByEmployee].forEach(receipt => {
          if (receipt.id) {
            receiptMap.set(receipt.id, receipt);
          }
        });
        const allReceipts = Array.from(receiptMap.values());
        console.log('Manager Team Page - Total unique receipts:', allReceipts.length);

        // Calculate team member data
        const memberData: TeamMemberData[] = employees.map(employee => {
          const memberReceipts = allReceipts.filter(r => 
            r.uploadedBy === employee.email || r.uploadedBy === employee.id
          );

          // Calculate total spending using getReceiptTotalAmount
          const totalSpending = memberReceipts.reduce((sum, receipt) => {
            return sum + getReceiptTotalAmount(receipt);
          }, 0);

          // Get last submission date
          const lastSubmission = memberReceipts.length > 0
            ? format(new Date(memberReceipts.sort((a, b) => 
                new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
              )[0].uploadedAt), 'yyyy-MM-dd')
            : 'N/A';

          // Count pending approvals
          const pendingApprovals = memberReceipts.filter(r => r.status === 'pending_approval').length;

          return {
            id: employee.id,
            name: employee.name || employee.email || 'Unknown',
            email: employee.email || '',
            role: employee.role || 'Employee',
            totalSpending,
            receipts: memberReceipts.length,
            status: 'active', // Default to active
            lastSubmission,
            pendingApprovals
          };
        });

        // Calculate team statistics
        const totalSpending = allReceipts.reduce((sum, receipt) => {
          return sum + getReceiptTotalAmount(receipt);
        }, 0);

        const pendingApprovals = allReceipts.filter(r => r.status === 'pending_approval').length;
        const fraudAlerts = allReceipts.filter(r => r.isFraudulent).length;

        setTeamMembers(memberData);
        setTeamStats({
          totalMembers: employees.length,
          activeMembers: employees.length, // All employees are considered active
          totalSpending,
          averagePerMember: employees.length > 0 ? totalSpending / employees.length : 0,
          pendingApprovals,
          fraudAlerts,
          totalReceipts: allReceipts.length
        });

      } catch (error) {
        console.error('Manager Team Page - Error loading team data:', error);
        // Set empty state on error
        setTeamMembers([]);
        setTeamStats({
          totalMembers: 0,
          activeMembers: 0,
          totalSpending: 0,
          averagePerMember: 0,
          pendingApprovals: 0,
          fraudAlerts: 0,
          totalReceipts: 0
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id, user?.companyId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "suspended":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />;
      case "inactive":
        return <Clock className="h-4 w-4" />;
      case "suspended":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-600 mt-2">Manage your team members and their expense submissions</p>
      </div>

      {/* Team Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamStats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">Team size</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${teamStats.totalSpending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{teamStats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">Requires review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{teamStats.fraudAlerts}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage your team members and their expense submissions</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No team members found</p>
            </div>
          ) : (
            <div className="space-y-5">
              {teamMembers.map((member) => (
              <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 sm:p-6 border rounded-lg hover:bg-gray-50 transition-colors gap-5 sm:gap-4">
                <div className="flex items-start space-x-4 flex-1 min-w-0">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-base sm:text-lg">{member.name}</h3>
                      <Badge variant={getStatusColor(member.status)} className="text-xs">
                        {getStatusIcon(member.status)}
                        <span className="ml-1 capitalize">{member.status}</span>
                      </Badge>
                    </div>
                    <p className="text-sm sm:text-base text-gray-600 font-medium">{member.role}</p>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                      <span className="flex items-center truncate">
                        <Mail className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </span>
                      <span className="flex items-center">
                        <Receipt className="h-3.5 w-3.5 mr-1.5" />
                        {member.receipts} receipts
                      </span>
                      <span className="whitespace-nowrap">Last: {member.lastSubmission}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-4 flex-shrink-0 pt-2 sm:pt-0">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-lg sm:text-xl mb-1">${member.totalSpending.toLocaleString()}</div>
                      <div className="text-xs sm:text-sm text-gray-500">Total spent</div>
                    </div>
                    {member.pendingApprovals > 0 && (
                      <Badge variant="secondary" className="w-fit text-xs self-start sm:self-center">
                        {member.pendingApprovals} pending
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm py-2">
                      <Phone className="h-4 w-4 mr-2" />
                      <span>Call</span>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm py-2">
                      <Mail className="h-4 w-4 mr-2" />
                      <span>Email</span>
                    </Button>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Summary</CardTitle>
          <CardDescription>Key metrics and insights for your team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Active Members</h3>
              <p className="text-sm text-gray-600">{teamStats.activeMembers} of {teamStats.totalMembers} members</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Average per Member</h3>
              <p className="text-sm text-gray-600">${teamStats.averagePerMember.toFixed(2)} per person</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Receipt className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <h3 className="font-medium mb-1">Total Receipts</h3>
              <p className="text-sm text-gray-600">{teamStats.totalReceipts} receipts submitted</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}