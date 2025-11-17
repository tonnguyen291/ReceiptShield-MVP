'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Trophy, Award, Medal } from 'lucide-react';

interface EmployeeLeaderboardData {
  employee: string;
  amount: number;
  count: number;
  department: string;
}

interface EmployeeLeaderboardChartProps {
  data: EmployeeLeaderboardData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316', '#fbbf24', '#d97706'];

const getRankIcon = (index: number) => {
  switch (index) {
    case 0:
      return <Trophy className="h-4 w-4 text-yellow-500" />;
    case 1:
      return <Award className="h-4 w-4 text-gray-400" />;
    case 2:
      return <Medal className="h-4 w-4 text-amber-600" />;
    default:
      return <span className="text-sm font-bold text-gray-500">#{index + 1}</span>;
  }
};

export function EmployeeLeaderboardChart({ data }: EmployeeLeaderboardChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No employee data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort data by amount descending and clean employee names
  const sortedData = [...data]
    .sort((a, b) => b.amount - a.amount)
    .map(item => ({
      ...item,
      employee: item.employee.replace(/-+$/, '').replace(/@.*$/, ''), // Remove trailing dashes and email domain
      amount: Number(item.amount) || 0 // Ensure amount is a number
    }))
    .filter(item => item.amount > 0); // Filter out zero amounts

  if (sortedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No employee data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ensure all amounts are valid numbers
  const validData = sortedData.map(item => ({
    ...item,
    amount: Math.max(0, Number(item.amount) || 0)
  }));

  const totalSpend = validData.reduce((sum, item) => sum + item.amount, 0);
  const topEmployee = validData[0];
  const avgPerEmployee = totalSpend / validData.length;

  // Calculate max value for proper domain
  const maxAmount = Math.max(...validData.map(item => item.amount), 0);
  const domainMax = maxAmount > 0 ? Math.ceil(maxAmount * 1.1) : 1000; // Add 10% padding and round up
  

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatTooltip = (value: number | string, name: string) => {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    if (name === 'amount' || name === 'Total Spend') {
      return [formatCurrency(Number(numValue.toFixed(2))), 'Total Spend'];
    }
    if (name === 'count' || name === 'Receipt Count') {
      return [numValue, 'Receipt Count'];
    }
    return [typeof value === 'number' ? value.toFixed(2) : value, name];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Employee Leaderboard
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <span>Top Spender:</span>
            <span className="font-semibold">{topEmployee.employee}</span>
            <span className="text-green-600">
              ({formatCurrency(topEmployee.amount)})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>Department:</span>
            <span className="font-semibold">{topEmployee.department}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full" style={{ minHeight: '320px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={validData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 60,
              }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="employee"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
                tickFormatter={(value) => {
                  // Remove trailing dashes and truncate if too long
                  const cleanValue = value.toString().replace(/-+$/, '').replace(/@.*$/, '');
                  return cleanValue.length > 10 ? cleanValue.substring(0, 10) + '...' : cleanValue;
                }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={formatCurrency}
                domain={[0, domainMax]}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => `Employee: ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar 
                dataKey="amount" 
                name="Total Spend"
                radius={[4, 4, 0, 0]}
                fill="#3b82f6"
                stroke="#1e40af"
                strokeWidth={2}
                isAnimationActive={true}
              >
                {validData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Top 3 Employees */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Top Performers</h4>
          <div className="space-y-2">
            {validData.slice(0, 3).map((employee, index) => (
              <div key={employee.employee} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getRankIcon(index)}
                  <div>
                    <div className="font-medium text-gray-900">{employee.employee}</div>
                    <div className="text-sm text-gray-500">{employee.department}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(employee.amount)}</div>
                  <div className="text-sm text-gray-500">{employee.count} receipts</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Employees</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {validData.length}
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Avg per Employee</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(avgPerEmployee)}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Total Receipts</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {validData.reduce((sum, item) => sum + item.count, 0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
