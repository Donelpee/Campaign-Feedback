import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Building2,
  FileText,
  TrendingUp,
  Star,
  ThumbsUp,
  Loader2,
} from 'lucide-react';

interface Metrics {
  totalCompanies: number;
  totalCampaigns: number;
  totalResponses: number;
  avgSatisfaction: number;
  avgServiceQuality: number;
  avgRecommendation: number;
  responsesByCompany: { name: string; responses: number }[];
  satisfactionDistribution: { rating: string; count: number }[];
  improvementAreas: { area: string; count: number }[];
}

const COLORS = ['hsl(220, 70%, 50%)', 'hsl(174, 60%, 45%)', 'hsl(280, 65%, 60%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(199, 89%, 48%)', 'hsl(300, 50%, 50%)'];

const areaLabels: Record<string, string> = {
  communication: 'Communication',
  response_time: 'Response Time',
  product_quality: 'Product Quality',
  customer_service: 'Customer Service',
  pricing: 'Pricing',
  technical_support: 'Technical Support',
  delivery: 'Delivery',
  documentation: 'Documentation',
};

export function DashboardOverview() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      // Get counts
      const [companiesRes, campaignsRes, responsesRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }),
        supabase.from('feedback_responses').select('id', { count: 'exact', head: true }),
      ]);

      // Get responses with details for calculations
      const { data: responses } = await supabase
        .from('feedback_responses')
        .select(`
          overall_satisfaction,
          service_quality,
          recommendation_likelihood,
          improvement_areas,
          link:link_id (
            company:company_id (name)
          )
        `);

      if (!responses) {
        setIsLoading(false);
        return;
      }

      // Calculate averages
      const avgSatisfaction =
        responses.length > 0
          ? responses.reduce((sum, r) => sum + r.overall_satisfaction, 0) / responses.length
          : 0;

      const avgServiceQuality =
        responses.length > 0
          ? responses.reduce((sum, r) => sum + r.service_quality, 0) / responses.length
          : 0;

      const avgRecommendation =
        responses.length > 0
          ? responses.reduce((sum, r) => sum + r.recommendation_likelihood, 0) / responses.length
          : 0;

      // Responses by company
      const companyMap = new Map<string, number>();
      responses.forEach((r) => {
        const link = r.link as { company: { name: string } } | null;
        const companyName = link?.company?.name || 'Unknown';
        companyMap.set(companyName, (companyMap.get(companyName) || 0) + 1);
      });
      const responsesByCompany = Array.from(companyMap.entries()).map(([name, responses]) => ({
        name,
        responses,
      }));

      // Satisfaction distribution
      const satisfactionMap = new Map<number, number>();
      responses.forEach((r) => {
        satisfactionMap.set(r.overall_satisfaction, (satisfactionMap.get(r.overall_satisfaction) || 0) + 1);
      });
      const satisfactionDistribution = Array.from({ length: 10 }, (_, i) => ({
        rating: String(i + 1),
        count: satisfactionMap.get(i + 1) || 0,
      }));

      // Improvement areas
      const areaMap = new Map<string, number>();
      responses.forEach((r) => {
        (r.improvement_areas || []).forEach((area) => {
          areaMap.set(area, (areaMap.get(area) || 0) + 1);
        });
      });
      const improvementAreas = Array.from(areaMap.entries())
        .map(([area, count]) => ({ area: areaLabels[area] || area, count }))
        .sort((a, b) => b.count - a.count);

      setMetrics({
        totalCompanies: companiesRes.count || 0,
        totalCampaigns: campaignsRes.count || 0,
        totalResponses: responsesRes.count || 0,
        avgSatisfaction,
        avgServiceQuality,
        avgRecommendation,
        responsesByCompany,
        satisfactionDistribution,
        improvementAreas,
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Dashboard Overview</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalResponses || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across all campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Satisfaction</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.avgSatisfaction.toFixed(1) || '0'}/10
                </div>
                <p className="text-xs text-muted-foreground">
                  Overall satisfaction score
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Service Quality</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.avgServiceQuality.toFixed(1) || '0'}/5
                </div>
                <p className="text-xs text-muted-foreground">
                  Star rating average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recommendation</CardTitle>
                <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics?.avgRecommendation.toFixed(1) || '0'}/5
                </div>
                <p className="text-xs text-muted-foreground">
                  Likelihood to recommend
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Responses by Company */}
            <Card>
              <CardHeader>
                <CardTitle>Responses by Company</CardTitle>
                <CardDescription>Distribution of feedback across companies</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics?.responsesByCompany && metrics.responsesByCompany.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.responsesByCompany}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                        }}
                      />
                      <Bar dataKey="responses" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Satisfaction Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Satisfaction Distribution</CardTitle>
                <CardDescription>How ratings are distributed (1-10)</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics?.satisfactionDistribution ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics.satisfactionDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="rating" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 'var(--radius)',
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Improvement Areas */}
          <Card>
            <CardHeader>
              <CardTitle>Areas for Improvement</CardTitle>
              <CardDescription>Most commonly mentioned areas needing improvement</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics?.improvementAreas && metrics.improvementAreas.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.improvementAreas}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ area, percent }) => `${area} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {metrics.improvementAreas.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No improvement areas reported yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalCompanies || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Companies receiving feedback
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalCampaigns || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Feedback collection periods
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
