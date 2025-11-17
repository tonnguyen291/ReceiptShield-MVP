'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Store, AlertTriangle, TrendingUp } from 'lucide-react';

interface VendorAnalysisData {
  vendor: string;
  amount: number;
  percentage: number;
  cumulativePercentage: number;
}

interface VendorAnalysisChartProps {
  data: VendorAnalysisData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];

export function VendorAnalysisChart({ data }: VendorAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Vendor Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No vendor data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const topVendors = data.slice(0, 10); // Show top 10 vendors
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const topVendor = data[0];
  const pareto80 = data.find(item => item.cumulativePercentage >= 80);
  const concentrationRisk = pareto80 ? pareto80.cumulativePercentage : 0;

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
    if (name === 'amount' || name === 'Spend Amount') {
      return [formatCurrency(Number(numValue.toFixed(2))), 'Spend Amount'];
    }
    if (name === 'cumulativePercentage' || name === 'Cumulative %') {
      return [`${numValue.toFixed(1)}%`, 'Cumulative %'];
    }
    return [typeof value === 'number' ? value.toFixed(2) : value, name];
  };

  const getRiskLevel = (percentage: number) => {
    if (percentage >= 80) return { level: 'High', color: 'text-red-600', bg: 'bg-red-50' };
    if (percentage >= 60) return { level: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'Low', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const riskLevel = getRiskLevel(concentrationRisk);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Vendor Analysis (Pareto Chart)
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <span>Top Vendor:</span>
            <span className="font-semibold">{topVendor.vendor}</span>
            <span className="text-green-600">
              ({formatCurrency(topVendor.amount)})
            </span>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${riskLevel.bg}`}>
            <AlertTriangle className={`h-3 w-3 ${riskLevel.color}`} />
            <span className={`text-xs font-medium ${riskLevel.color}`}>
              Risk: {riskLevel.level}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={topVendors}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="vendor" 
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                yAxisId="amount"
                orientation="left"
                tick={{ fontSize: 12 }}
                tickFormatter={formatCurrency}
              />
              <YAxis 
                yAxisId="percentage"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => `Vendor: ${label}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar 
                yAxisId="amount"
                dataKey="amount" 
                name="Spend Amount"
                radius={[4, 4, 0, 0]}
              >
                {topVendors.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
              <Line 
                yAxisId="percentage"
                type="monotone" 
                dataKey="cumulativePercentage" 
                stroke="#ef4444" 
                strokeWidth={3}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                name="Cumulative %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Pareto Analysis */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pareto Analysis
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">80/20 Rule Analysis</div>
              <div className="text-lg font-semibold text-gray-900">
                {pareto80 ? `${data.slice(0, data.indexOf(pareto80) + 1).length} vendors` : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                account for 80% of spend
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Concentration Risk</div>
              <div className={`text-lg font-semibold ${riskLevel.color}`}>
                {concentrationRisk.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">
                {riskLevel.level} risk level
              </div>
            </div>
          </div>
        </div>
        
        {/* Top Vendors List */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Top Vendors</h4>
          <div className="space-y-2">
            {topVendors.slice(0, 5).map((vendor, index) => (
              <div key={vendor.vendor} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{vendor.vendor}</div>
                    <div className="text-sm text-gray-500">{vendor.percentage.toFixed(1)}% of total</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrency(vendor.amount)}</div>
                  <div className="text-sm text-gray-500">{vendor.cumulativePercentage.toFixed(1)}% cumulative</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
