import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Calendar } from 'lucide-react';
import type { Campaign } from '@/lib/supabase-types';

export function CampaignsManager() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load campaigns.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData({
        name: campaign.name,
        description: campaign.description || '',
        start_date: campaign.start_date,
        end_date: campaign.end_date,
      });
    } else {
      setEditingCampaign(null);
      setFormData({ name: '', description: '', start_date: '', end_date: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.start_date || !formData.end_date) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'End date must be after start date.',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (editingCampaign) {
        const { error } = await supabase
          .from('campaigns')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            start_date: formData.start_date,
            end_date: formData.end_date,
          })
          .eq('id', editingCampaign.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Campaign updated successfully.',
        });
      } else {
        const { error } = await supabase.from('campaigns').insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
        });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Campaign created successfully.',
        });
      }

      setIsDialogOpen(false);
      loadCampaigns();
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save campaign.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    if (!confirm(`Are you sure you want to delete "${campaign.name}"? This will also delete all associated links and responses.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('campaigns').delete().eq('id', campaign.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Campaign deleted successfully.',
      });

      loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete campaign.',
      });
    }
  };

  const getStatus = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (now < start) {
      return { label: 'Upcoming', variant: 'secondary' as const };
    } else if (now > end) {
      return { label: 'Ended', variant: 'outline' as const };
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
        <h1 className="font-semibold text-lg">Campaigns</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Feedback Campaigns</CardTitle>
              <CardDescription>
                Create and manage quarterly feedback collection periods
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Campaign
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCampaign
                      ? 'Update the campaign details below.'
                      : 'Set up a new feedback collection period.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Campaign Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Q1 2026 Feedback"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the campaign..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({ ...formData, start_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, end_date: e.target.value })
                        }
                      />
                    </div>
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
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
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
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No campaigns yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first campaign to start collecting feedback.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const status = getStatus(campaign.start_date, campaign.end_date);
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(campaign.start_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(campaign.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(campaign)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(campaign)}
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
