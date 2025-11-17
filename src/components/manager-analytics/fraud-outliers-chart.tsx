'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Shield, AlertTriangle, User, Building2 } from 'lucide-react';

interface FraudOutliersData {
  employee: string;
  department: string;
  amount: number;
  isOutlier: boolean;
  zScore: number;
}

interface FraudOutliersChartProps {
  data: FraudOutliersData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];

export function FraudOutliersChart({ data }: FraudOutliersChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Fraud & Outliers Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No fraud analysis data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const outliers = data.filter(item => item.isOutlier);
  const normalSpenders = data.filter(item => !item.isOutlier);
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const outlierAmount = outliers.reduce((sum, item) => sum + item.amount, 0);
  const outlierPercentage = (outlierAmount / totalAmount) * 100;

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
    if (name === 'zScore' || name === 'Z-Score') {
      return [numValue.toFixed(2), 'Z-Score'];
    }
    return [typeof value === 'number' ? value.toFixed(2) : value, name];
  };

  const getRiskLevel = (zScore: number) => {
    if (Math.abs(zScore) > 3) return { level: 'Critical', color: 'text-red-600', bg: 'bg-red-50' };
    if (Math.abs(zScore) > 2) return { level: 'High', color: 'text-orange-600', bg: 'bg-orange-50' };
    if (Math.abs(zScore) > 1.5) return { level: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Low', color: 'text-green-600', bg: 'bg-green-50' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Fraud & Outliers Analysis
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span>Outliers Detected:</span>
            <span className="font-semibold text-orange-600">{outliers.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Outlier Spend:</span>
            <span className="font-semibold text-red-600">
              {formatCurrency(outlierAmount)} ({outlierPercentage.toFixed(1)}%)
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
                dataKey="employee" 
                tick={{ fontSize: 10 }}
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
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isOutlier ? '#ef4444' : COLORS[index % COLORS.length]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Outlier Analysis */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Outlier Analysis
          </h4>
          {outliers.length > 0 ? (
            <div className="space-y-3">
              {outliers.map((outlier, index) => {
                const riskLevel = getRiskLevel(outlier.zScore);
                return (
                  <div key={outlier.employee} className="p-4 bg-white border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{outlier.employee}</div>
                          <div className="text-sm text-gray-500">{outlier.department}</div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${riskLevel.bg} ${riskLevel.color}`}>
                        {riskLevel.level} Risk
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Amount:</span>
                        <span className="ml-2 font-semibold text-red-600">
                          {formatCurrency(outlier.amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Z-Score:</span>
                        <span className="ml-2 font-semibold">
                          {outlier.zScore.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-green-600">
              <Shield className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">No outliers detected</p>
              <p className="text-sm text-gray-500">All spending patterns appear normal</p>
            </div>
          )}
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Employees</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {data.length}
            </div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">Outliers</span>
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {outliers.length}
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-900">Normal Spenders</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {normalSpenders.length}
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Risk Level</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 mt-1">
              {outliers.length === 0 ? 'Low' : outliers.length > 3 ? 'High' : 'Medium'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
