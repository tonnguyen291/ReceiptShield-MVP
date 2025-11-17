'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users } from 'lucide-react';

interface UserVsAverageChartProps {
  data: { userSpent: number; averageSpent: number; period: string };
  className?: string;
}

export function UserVsAverageChart({ data, className }: UserVsAverageChartProps) {
  const { userSpent, averageSpent, period } = data;
  
  // Calculate percentage difference
  const percentageDiff = averageSpent > 0 ? ((userSpent - averageSpent) / averageSpent) * 100 : 0;
  const isAboveAverage = userSpent > averageSpent;
  
  // Prepare chart data
  const chartData = [
    {
      name: 'Your Spending',
      amount: userSpent,
      type: 'user'
    },
    {
      name: 'Company Average',
      amount: averageSpent,
      type: 'average'
    }
  ];

  const maxAmount = Math.max(userSpent, averageSpent);
  const chartHeight = 200;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">User vs Average</CardTitle>
        <div className="flex items-center space-x-1">
          {isAboveAverage ? (
            <TrendingUp className="h-4 w-4 text-red-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-green-600" />
          )}
          <span className={`text-sm font-medium ${
            isAboveAverage ? 'text-red-600' : 'text-green-600'
          }`}>
            {Math.abs(percentageDiff).toFixed(1)}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Chart */}
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: '#6b7280' }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: '#6b7280' }}
                  tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium text-gray-900">{data.name}</p>
                          <p className={`font-semibold ${
                            data.type === 'user' ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            ${data.amount.toFixed(2)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <span className="text-sm font-medium text-blue-900">Your Spending</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">${userSpent.toFixed(2)}</p>
              <p className="text-xs text-blue-700">{period === 'all_time' ? 'All Time' : period.replace('_', ' ')}</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="h-3 w-3 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Company Average</span>
              </div>
              <p className="text-2xl font-bold text-gray-600">${averageSpent.toFixed(2)}</p>
              <p className="text-xs text-gray-700">{period === 'all_time' ? 'All Time' : period.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Comparison Message */}
          <div className={`p-4 rounded-lg border ${
            isAboveAverage 
              ? 'bg-red-50 border-red-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start space-x-2">
              {isAboveAverage ? (
                <TrendingUp className="h-5 w-5 text-red-600 mt-0.5" />
              ) : (
                <TrendingDown className="h-5 w-5 text-green-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  isAboveAverage ? 'text-red-900' : 'text-green-900'
                }`}>
                  {isAboveAverage ? 'Above Average Spending' : 'Below Average Spending'}
                </p>
                <p className={`text-sm ${
                  isAboveAverage ? 'text-red-700' : 'text-green-700'
                }`}>
                  You are spending {Math.abs(percentageDiff).toFixed(1)}% {
                    isAboveAverage ? 'more' : 'less'
                  } than the company average {period === 'all_time' ? 'overall' : `this ${period.replace('_', ' ')}`}.
                  {isAboveAverage && (
                    <span className="block mt-1">
                      Consider reviewing your expenses to align with company norms.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
