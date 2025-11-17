'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calendar, Building2 } from 'lucide-react';

interface DepartmentTrendsData {
  month: string;
  [department: string]: string | number;
}

interface DepartmentTrendsChartProps {
  data: DepartmentTrendsData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];

export function DepartmentTrendsChart({ data }: DepartmentTrendsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Department Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get all department names (excluding 'month')
  const departments = Object.keys(data[0]).filter(key => key !== 'month');
  const totalSpend = data.reduce((sum, month) => {
    return sum + departments.reduce((deptSum, dept) => {
      return deptSum + (typeof month[dept] === 'number' ? month[dept] : 0);
    }, 0);
  }, 0);

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
    return [formatCurrency(Number(numValue.toFixed(2))), name];
  };

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  // Calculate growth rates
  const getGrowthRate = (dept: string) => {
    if (data.length < 2) return 0;
    const firstMonthValue = data[0][dept];
    const lastMonthValue = data[data.length - 1][dept];
    const firstMonth = typeof firstMonthValue === 'number' ? firstMonthValue : 0;
    const lastMonth = typeof lastMonthValue === 'number' ? lastMonthValue : 0;
    if (firstMonth === 0) return lastMonth > 0 ? 100 : 0;
    return ((lastMonth - firstMonth) / firstMonth) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Department Trends
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Period: {data.length} months</span>
          </div>
          <div className="flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            <span>Departments: {departments.length}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                dataKey="month" 
                tick={{ fontSize: 12 }}
                tickFormatter={formatMonth}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => `Month: ${formatMonth(label)}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              {departments.map((dept, index) => (
                <Line
                  key={dept}
                  type="monotone"
                  dataKey={dept}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[index % COLORS.length], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: COLORS[index % COLORS.length], strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Growth Analysis */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Growth Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept, index) => {
              const growthRate = getGrowthRate(dept);
              const isPositive = growthRate > 0;
              const isNegative = growthRate < 0;
              
              return (
                <div key={dept} className="p-4 bg-white border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900">{dept}</div>
                    <div className={`text-sm font-semibold ${
                      isPositive ? 'text-green-600' : 
                      isNegative ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {isPositive ? '+' : ''}{growthRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {isPositive ? 'Growing' : isNegative ? 'Declining' : 'Stable'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Period Spend</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {formatCurrency(totalSpend)}
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Avg per Month</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(totalSpend / data.length)}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Active Departments</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {departments.length}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
