'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Building2, TrendingUp, TrendingDown } from 'lucide-react';

interface DepartmentSpendData {
  department: string;
  amount: number;
  count: number;
}

interface DepartmentSpendChartProps {
  data: DepartmentSpendData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

export function DepartmentSpendChart({ data }: DepartmentSpendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Department Spend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No department data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalSpend = data.reduce((sum, item) => sum + item.amount, 0);
  const topDepartment = data[0];
  const avgPerDepartment = totalSpend / data.length;

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
          <Building2 className="h-5 w-5" />
          Department Spend Analysis
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <span>Total Spend:</span>
            <span className="font-semibold">{formatCurrency(totalSpend)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Top Department:</span>
            <span className="font-semibold">{topDepartment.department}</span>
            <span className="text-green-600">
              ({formatCurrency(topDepartment.amount)})
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="department" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => `Department: ${label}`}
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
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Departments</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {data.length}
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Avg per Dept</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(avgPerDepartment)}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Total Receipts</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {data.reduce((sum, item) => sum + item.count, 0)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
