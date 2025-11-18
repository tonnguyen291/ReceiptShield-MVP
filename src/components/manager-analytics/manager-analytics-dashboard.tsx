'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, TrendingUp, AlertTriangle, Users, Building2, Store, Clock } from 'lucide-react';
import { DepartmentSpendChart } from './department-spend-chart';
import { EmployeeLeaderboardChart } from './employee-leaderboard-chart';
import { VendorAnalysisChart } from './vendor-analysis-chart';
import { DepartmentTrendsChart } from './department-trends-chart';
import { FraudOutliersChart } from './fraud-outliers-chart';
import { SubmissionTimingHeatmap } from './submission-timing-heatmap';
import { getManagerAnalytics, type ManagerAnalytics } from '@/lib/data-service';
import { useAuth } from '@/contexts/auth-context';

interface ManagerAnalyticsDashboardProps {
  managerId: string;
}

export function ManagerAnalyticsDashboard({ managerId }: ManagerAnalyticsDashboardProps) {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<ManagerAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed'>('overview');

  const loadAnalytics = useCallback(async () => {
    if (!managerId) {
      setError('Manager ID is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      // Pass companyId to filter by company
      const data = await getManagerAnalytics(managerId, user?.companyId);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load manager analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [managerId, user?.companyId]);

  useEffect(() => {
    if (managerId) {
      loadAnalytics();
    }
  }, [managerId, loadAnalytics]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Manager Analytics</h2>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Manager Analytics</h2>
          <Button onClick={loadAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Manager Analytics</h2>
        <Card>
          <CardContent className="p-6 text-center">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">No analytics data found for this manager.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSpend = analytics.departmentSpend.reduce((sum, dept) => sum + dept.amount, 0);
  const totalEmployees = analytics.employeeLeaderboard.length;
  const totalOutliers = analytics.fraudOutliers.filter(item => item.isOutlier).length;
  const totalSubmissions = analytics.submissionTiming.reduce((sum, item) => sum + item.count, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Manager Analytics Dashboard</h2>
          <p className="text-gray-600">Comprehensive insights into team spending and patterns</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </Button>
          <Button
            variant={activeTab === 'detailed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('detailed')}
          >
            Detailed
          </Button>
          <Button onClick={loadAnalytics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Spend</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Employees</p>
                <p className="text-2xl font-bold text-gray-900">{totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Outliers Detected</p>
                <p className="text-2xl font-bold text-gray-900">{totalOutliers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Submissions</p>
                <p className="text-2xl font-bold text-gray-900">{totalSubmissions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DepartmentSpendChart data={analytics.departmentSpend} />
          <EmployeeLeaderboardChart data={analytics.employeeLeaderboard} />
          <VendorAnalysisChart data={analytics.vendorAnalysis} />
          <FraudOutliersChart data={analytics.fraudOutliers} />
        </div>
      ) : (
        <div className="space-y-6">
          <DepartmentTrendsChart data={analytics.departmentTrends} />
          <SubmissionTimingHeatmap data={analytics.submissionTiming} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DepartmentSpendChart data={analytics.departmentSpend} />
            <EmployeeLeaderboardChart data={analytics.employeeLeaderboard} />
            <VendorAnalysisChart data={analytics.vendorAnalysis} />
            <FraudOutliersChart data={analytics.fraudOutliers} />
          </div>
        </div>
      )}

      {/* Quick Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.departmentSpend.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Top Spending Department</h4>
                <p className="text-blue-700">
                  {analytics.departmentSpend[0].department} leads with{' '}
                  {formatCurrency(analytics.departmentSpend[0].amount)} in total spend.
                </p>
              </div>
            )}
            
            {analytics.employeeLeaderboard.length > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-900 mb-2">Top Performer</h4>
                <p className="text-green-700">
                  {analytics.employeeLeaderboard[0].employee} from{' '}
                  {analytics.employeeLeaderboard[0].department} has the highest spend at{' '}
                  {formatCurrency(analytics.employeeLeaderboard[0].amount)}.
                </p>
              </div>
            )}
            
            {totalOutliers > 0 && (
              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-semibold text-orange-900 mb-2">Risk Alert</h4>
                <p className="text-orange-700">
                  {totalOutliers} outlier{totalOutliers > 1 ? 's' : ''} detected. 
                  Review spending patterns for potential fraud or policy violations.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
