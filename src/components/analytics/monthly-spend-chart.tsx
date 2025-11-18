'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MonthlySpendChartProps {
  data: { month: string; amount: number }[];
  className?: string;
}

export function MonthlySpendChart({ data, className }: MonthlySpendChartProps) {
  // Format data for display
  const formattedData = data.map(item => ({
    ...item,
    displayMonth: formatMonth(item.month),
    amount: Math.round(item.amount * 100) / 100 // Round to 2 decimal places
  }));

  // Calculate trend
  const trend = calculateTrend(data);
  const isPositiveTrend = trend > 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Monthly Spend Overview</CardTitle>
        <div className="flex items-center space-x-1">
          {isPositiveTrend ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
          <span className={`text-sm font-medium ${
            isPositiveTrend ? 'text-green-600' : 'text-red-600'
          }`}>
            {Math.abs(trend).toFixed(1)}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="displayMonth" 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#6b7280' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={{ stroke: '#6b7280' }}
                tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium text-gray-900">{label}</p>
                        <p className="text-blue-600">
                          Amount: <span className="font-semibold">${typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>Showing spending trends over the last {data.length} months</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatMonth(monthString: string): string {
  try {
    // Handle "YYYY-MM" format
    if (monthString.includes('-')) {
      const [year, month] = monthString.split('-');
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      
      // Validate the parsed values
      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return monthString; // Return original if invalid
      }
      
      const date = new Date(yearNum, monthNum - 1, 1);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return monthString;
      }
      
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    
    // If format is unexpected, try to return as-is or parse differently
    return monthString;
  } catch (error) {
    console.error('Error formatting month:', error, monthString);
    return monthString; // Return original string on error
  }
}

function calculateTrend(data: { month: string; amount: number }[]): number {
  if (data.length < 2) return 0;

  const latestAmount = data[data.length - 1].amount;

  // Find the most recent month before the latest with a recorded amount (including zero)
  let comparisonAmount: number | null = null;
  for (let i = data.length - 2; i >= 0; i--) {
    const amount = data[i].amount;
    if (amount !== null && amount !== undefined) {
      comparisonAmount = amount;
      break;
    }
  }

  if (comparisonAmount === null) {
    return 0;
  }

  if (comparisonAmount === 0) {
    return latestAmount === 0 ? 0 : 100;
  }

  return ((latestAmount - comparisonAmount) / comparisonAmount) * 100;
}
