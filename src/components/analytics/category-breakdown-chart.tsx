'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { PieChart as PieChartIcon, BarChart3 } from 'lucide-react';

interface CategoryBreakdownChartProps {
  data: { category: string; amount: number; percentage: number }[];
  className?: string;
}

const COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];

export function CategoryBreakdownChart({ data, className }: CategoryBreakdownChartProps) {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base font-medium">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium">No spending data available</p>
              <p className="text-sm">Submit receipts to see category breakdown</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Category Breakdown</CardTitle>
        <div className="flex space-x-1">
          <Button
            variant={chartType === 'pie' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('pie')}
            className="h-8 w-8 p-0"
          >
            <PieChartIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={chartType === 'bar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('bar')}
            className="h-8 w-8 p-0"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {chartType === 'pie' ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category} (${percentage.toFixed(1)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-medium text-gray-900">{data.category}</p>
                          <p className="text-blue-600">
                            Amount: <span className="font-semibold">${data.amount.toFixed(2)}</span>
                          </p>
                          <p className="text-gray-600">
                            Percentage: <span className="font-semibold">{data.percentage.toFixed(1)}%</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 12 }}
                  tickLine={{ stroke: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
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
                          <p className="font-medium text-gray-900">{data.category}</p>
                          <p className="text-blue-600">
                            Amount: <span className="font-semibold">${data.amount.toFixed(2)}</span>
                          </p>
                          <p className="text-gray-600">
                            Percentage: <span className="font-semibold">{data.percentage.toFixed(1)}%</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {data.slice(0, 4).map((item, index) => (
            <div key={item.category} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-sm text-gray-600 truncate">{item.category}</span>
              <span className="text-sm font-medium">${item.amount.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
