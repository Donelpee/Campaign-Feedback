import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, FileText, Star, RefreshCw } from 'lucide-react';
import { FileSpreadsheet } from 'lucide-react';
import type { Company, Campaign } from '@/lib/supabase-types';
import { exportToExcel } from '@/lib/excel-export';

interface ResponseWithDetails {
  id: string;
  link_id: string;
  overall_satisfaction: number;
  service_quality: number;
  recommendation_likelihood: number;
  improvement_areas: string[];
  additional_comments: string | null;
  created_at: string;
  link: {
    company: Company;
    campaign: Campaign;
  };
}

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

export function ResponsesViewer() {
  const { toast } = useToast();
  const [responses, setResponses] = useState<ResponseWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('feedback-responses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feedback_responses',
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = async () => {
    try {
      const [responsesRes, companiesRes, campaignsRes] = await Promise.all([
        supabase
          .from('feedback_responses')
          .select(`
            *,
            link:link_id (
              company:company_id (*),
              campaign:campaign_id (*)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('*').order('name'),
        supabase.from('campaigns').select('*').order('start_date', { ascending: false }),
      ]);

      if (responsesRes.error) throw responsesRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      setResponses(
        (responsesRes.data || []).map((r) => ({
          ...r,
          link: {
            company: (r.link as any).company as Company,
            campaign: (r.link as any).campaign as Campaign,
          },
        }))
      );
      setCompanies(companiesRes.data || []);
      setCampaigns(campaignsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load responses.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResponses = responses.filter((r) => {
    if (filterCompany !== 'all' && r.link.company.id !== filterCompany) {
      return false;
    }
    if (filterCampaign !== 'all' && r.link.campaign.id !== filterCampaign) {
      return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    if (filteredResponses.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No responses to export.',
      });
      return;
    }

    const headers = [
      'Company',
      'Campaign',
      'Overall Satisfaction',
      'Service Quality',
      'Recommendation',
      'Improvement Areas',
      'Comments',
      'Date',
    ];

    const rows = filteredResponses.map((r) => [
      r.link.company.name,
      r.link.campaign.name,
      r.overall_satisfaction,
      r.service_quality,
      r.recommendation_likelihood,
      (r.improvement_areas || []).map((a) => areaLabels[a] || a).join('; '),
      r.additional_comments || '',
      new Date(r.created_at).toLocaleString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell);
            // Escape quotes and wrap in quotes if contains comma or quote
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback-responses-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: 'CSV file downloaded successfully.',
    });
  };

  const handleExportExcel = async () => {
    if (filteredResponses.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No responses to export.',
      });
      return;
    }

    setIsExporting(true);
    try {
      const data = filteredResponses.map(r => ({
        id: r.id,
        overall_satisfaction: r.overall_satisfaction,
        service_quality: r.service_quality,
        recommendation_likelihood: r.recommendation_likelihood,
        improvement_areas: r.improvement_areas,
        additional_comments: r.additional_comments,
        created_at: r.created_at,
        company_name: r.link.company.name,
        campaign_name: r.link.campaign.name,
      }));

      await exportToExcel(data, `feedback-report-${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Success',
        description: 'Excel report with charts downloaded successfully.',
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate Excel report.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const renderStars = (value: number, max: number = 5) => {
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < value ? 'fill-warning text-warning' : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  const getLikertLabel = (value: number) => {
    const labels = ['Very Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Very Likely'];
    return labels[value - 1] || '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Responses</h1>
        <Button variant="ghost" size="icon" onClick={loadData} className="ml-auto" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Feedback Responses</CardTitle>
              <CardDescription>
                View and export all anonymous feedback submissions
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterCampaign} onValueChange={setFilterCampaign}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>

              <Button onClick={handleExportExcel} disabled={isExporting} variant="secondary">
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                )}
                Export Excel
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredResponses.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No responses yet</h3>
                <p className="text-sm text-muted-foreground">
                  {responses.length === 0
                    ? 'Responses will appear here once staff submit feedback.'
                    : 'No responses match the current filters.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-center">Satisfaction</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Recommendation</TableHead>
                      <TableHead>Improvement Areas</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResponses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell className="font-medium">
                          {response.link.company.name}
                        </TableCell>
                        <TableCell>{response.link.campaign.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              response.overall_satisfaction >= 7
                                ? 'default'
                                : response.overall_satisfaction >= 4
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {response.overall_satisfaction}/10
                          </Badge>
                        </TableCell>
                        <TableCell>{renderStars(response.service_quality)}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {getLikertLabel(response.recommendation_likelihood)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(response.improvement_areas || []).slice(0, 2).map((area) => (
                              <Badge key={area} variant="outline" className="text-xs">
                                {areaLabels[area] || area}
                              </Badge>
                            ))}
                            {(response.improvement_areas || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{response.improvement_areas.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(response.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
