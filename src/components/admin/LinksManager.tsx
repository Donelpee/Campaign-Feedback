import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Copy, Trash2, Loader2, Link2, ExternalLink } from 'lucide-react';
import type { Company, Campaign, CompanyCampaignLink } from '@/lib/supabase-types';

interface LinkWithDetails extends CompanyCampaignLink {
  company: Company;
  campaign: Campaign;
}

function generateUniqueCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function LinksManager() {
  const { toast } = useToast();
  const [links, setLinks] = useState<LinkWithDetails[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [linksRes, companiesRes, campaignsRes] = await Promise.all([
        supabase
          .from('company_campaign_links')
          .select(`
            *,
            company:company_id (*),
            campaign:campaign_id (*)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('*').order('name'),
        supabase.from('campaigns').select('*').order('start_date', { ascending: false }),
      ]);

      if (linksRes.error) throw linksRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (campaignsRes.error) throw campaignsRes.error;

      setLinks(
        (linksRes.data || []).map((link) => ({
          ...link,
          company: link.company as unknown as Company,
          campaign: link.campaign as unknown as Campaign,
        }))
      );
      setCompanies(companiesRes.data || []);
      setCampaigns(campaignsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedCompany || !selectedCampaign) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select both a company and a campaign.',
      });
      return;
    }

    // Check if link already exists
    const existing = links.find(
      (l) => l.company_id === selectedCompany && l.campaign_id === selectedCampaign
    );
    if (existing) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'A link for this company and campaign already exists.',
      });
      return;
    }

    setIsSaving(true);

    try {
      const uniqueCode = generateUniqueCode();

      const { error } = await supabase.from('company_campaign_links').insert({
        company_id: selectedCompany,
        campaign_id: selectedCampaign,
        unique_code: uniqueCode,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Feedback link created successfully.',
      });

      setIsDialogOpen(false);
      setSelectedCompany('');
      setSelectedCampaign('');
      loadData();
    } catch (error) {
      console.error('Error creating link:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create link.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (link: LinkWithDetails) => {
    try {
      const { error } = await supabase
        .from('company_campaign_links')
        .update({ is_active: !link.is_active })
        .eq('id', link.id);

      if (error) throw error;

      setLinks(
        links.map((l) =>
          l.id === link.id ? { ...l, is_active: !l.is_active } : l
        )
      );

      toast({
        title: 'Success',
        description: `Link ${!link.is_active ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      console.error('Error toggling link:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update link status.',
      });
    }
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}/feedback/${code}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Copied!',
      description: 'Feedback link copied to clipboard.',
    });
  };

  const handleDelete = async (link: LinkWithDetails) => {
    if (
      !confirm(
        `Are you sure you want to delete this link? This will also delete all associated responses.`
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from('company_campaign_links')
        .delete()
        .eq('id', link.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Link deleted successfully.',
      });

      loadData();
    } catch (error) {
      console.error('Error deleting link:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete link.',
      });
    }
  };

  const getStatus = (startDate: string, endDate: string, isActive: boolean) => {
    if (!isActive) {
      return { label: 'Inactive', variant: 'secondary' as const };
    }

    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) {
      return { label: 'Upcoming', variant: 'outline' as const };
    } else if (now > end) {
      return { label: 'Expired', variant: 'destructive' as const };
    } else {
      return { label: 'Active', variant: 'default' as const };
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="font-semibold text-lg">Feedback Links</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>URL Generation</CardTitle>
              <CardDescription>
                Generate and manage unique feedback URLs for each company
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Feedback Link</DialogTitle>
                  <DialogDescription>
                    Create a unique feedback URL for a specific company and campaign.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Campaign</Label>
                    <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Generate Link'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : links.length === 0 ? (
              <div className="text-center py-8">
                <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No links yet</h3>
                <p className="text-sm text-muted-foreground">
                  Generate your first feedback link to share with companies.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => {
                    const status = getStatus(
                      link.campaign.start_date,
                      link.campaign.end_date,
                      link.is_active
                    );
                    return (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">
                          {link.company.name}
                        </TableCell>
                        <TableCell>{link.campaign.name}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>{link.access_count}</TableCell>
                        <TableCell>
                          <Switch
                            checked={link.is_active}
                            onCheckedChange={() => handleToggleActive(link)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyLink(link.unique_code)}
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                window.open(`/feedback/${link.unique_code}`, '_blank')
                              }
                              title="Open link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(link)}
                              title="Delete link"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
