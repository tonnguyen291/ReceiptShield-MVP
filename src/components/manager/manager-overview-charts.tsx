
'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, DollarSign, Files, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { getReceiptsForManager } from '@/lib/receipt-store';
import { getReceiptTotalAmount } from '@/lib/data-service';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import type { ProcessedReceipt } from '@/types';

interface MonthlyTotal {
  name: string;
  total: number;
}

export function ManagerOverviewCharts() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalExpenses: 0,
    totalReceipts: 0,
    fraudAlerts: 0,
    pendingApprovals: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyTotal[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (user?.id) {
        const allReceipts = await getReceiptsForManager(user.id);

        // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
        const totalExpenses = allReceipts.reduce((acc, r) => {
          return acc + getReceiptTotalAmount(r);
        }, 0);

        const fraudAlerts = allReceipts.filter(r => r.isFraudulent).length;
        const pendingApprovals = allReceipts.filter(r => r.status === 'pending_approval').length;
      
      setStats({
        totalExpenses,
        totalReceipts: allReceipts.length,
        fraudAlerts,
        pendingApprovals,
      });

      // Generate data for the last 6 months
      const sixMonthsData: MonthlyTotal[] = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(today, i);
        const monthName = format(date, 'MMM');
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const monthReceipts = allReceipts.filter(r => {
          const receiptDate = new Date(r.uploadedAt);
          return receiptDate >= start && receiptDate <= end;
        });

        // Use getReceiptTotalAmount to get only the "Total Amount" field, not sum all items
        const monthTotal = monthReceipts.reduce((acc, r) => {
          return acc + getReceiptTotalAmount(r);
        }, 0);

        sixMonthsData.push({ name: monthName, total: monthTotal });
      }
      setMonthlyData(sixMonthsData);
      }
    };
    
    loadData();
  }, [user]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Sum of all team receipts</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receipts Submitted</CardTitle>
            <Files className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReceipts}</div>
            <p className="text-xs text-muted-foreground">Total submissions by team</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Alerts Triggered</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.fraudAlerts}</div>
            <p className="text-xs text-muted-foreground">Flagged by AI analysis</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">Receipts requiring review</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Monthly Expense Trends</CardTitle>
          <CardDescription>Overview of team-wide expenses over the last 6 months.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
                formatter={(value: any) => `$${Number(value).toFixed(2)}`}
              />
              <Legend wrapperStyle={{fontSize: "12px", paddingTop: '10px'}} />
              <Bar dataKey="total" fill="hsl(var(--primary))" activeBar={{ fill: 'hsl(var(--primary), 0.8)' }} radius={[4, 4, 0, 0]} name="Total Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
