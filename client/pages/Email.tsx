import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Mail, Send, Clock, CheckCircle, AlertCircle, Plus, Users } from 'lucide-react';
import { formatDate, formatNumber } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface EmailCampaign {
  id: number;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  createdAt: string;
  scheduledFor?: string;
}

interface VoterList {
  id: number;
  name: string;
  voterCount: number;
}

export function Email() {
  const queryClient = useQueryClient();
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({
    name: '',
    subject: '',
    body: '',
    listId: '',
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['email', 'campaigns'],
    queryFn: () => apiGet<{ success: boolean; data: EmailCampaign[] }>('/email/campaigns'),
  });

  const { data: listsData } = useQuery({
    queryKey: ['lists'],
    queryFn: () => apiGet<{ success: boolean; data: VoterList[] }>('/lists'),
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: typeof composeForm) => apiPost('/email/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'campaigns'] });
      setShowCompose(false);
      setComposeForm({ name: '', subject: '', body: '', listId: '' });
      toast({ title: 'Campaign created', description: 'Your email campaign is ready.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create campaign.', variant: 'destructive' });
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: (campaignId: number) => apiPost(`/email/campaigns/${campaignId}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'campaigns'] });
      toast({ title: 'Sending', description: 'Your campaign is being sent.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send campaign.', variant: 'destructive' });
    },
  });

  const campaigns = campaignsData?.data || [];
  const lists = listsData?.data || [];

  const getStatusBadge = (status: EmailCampaign['status']) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="text-blue-600"><Clock className="h-3 w-3 mr-1" /> Scheduled</Badge>;
      case 'sending':
        return <Badge variant="outline" className="text-yellow-600 animate-pulse">Sending...</Badge>;
      case 'sent':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Email Campaigns
          </h1>
          <p className="text-muted-foreground">
            Create and send email campaigns to your voter lists
          </p>
        </div>
        <Button onClick={() => setShowCompose(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatNumber(campaigns.length)}</div>
            <p className="text-xs text-muted-foreground">Total Campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatNumber(campaigns.reduce((sum, c) => sum + c.sentCount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Emails Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatNumber(campaigns.reduce((sum, c) => sum + c.openCount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Opens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatNumber(campaigns.reduce((sum, c) => sum + c.clickCount, 0))}
            </div>
            <p className="text-xs text-muted-foreground">Clicks</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      {campaignsLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first email campaign to reach voters.
            </p>
            <Button onClick={() => setShowCompose(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    <CardDescription>{campaign.subject}</CardDescription>
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {formatNumber(campaign.recipientCount)} recipients
                    </span>
                    {campaign.status === 'sent' && (
                      <>
                        <span className="flex items-center gap-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {formatNumber(campaign.sentCount)} sent
                        </span>
                        <span>
                          {campaign.sentCount > 0 
                            ? `${((campaign.openCount / campaign.sentCount) * 100).toFixed(1)}% open rate`
                            : '0% open rate'}
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">
                      Created {formatDate(campaign.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status === 'draft' && (
                      <Button
                        size="sm"
                        onClick={() => sendCampaignMutation.mutate(campaign.id)}
                        disabled={sendCampaignMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send Now
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Email Campaign</DialogTitle>
            <DialogDescription>
              Compose an email to send to voters in a list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  value={composeForm.name}
                  onChange={(e) => setComposeForm({ ...composeForm, name: e.target.value })}
                  placeholder="e.g., November GOTV"
                />
              </div>
              <div className="space-y-2">
                <Label>Recipient List</Label>
                <Select
                  value={composeForm.listId}
                  onValueChange={(v) => setComposeForm({ ...composeForm, listId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map(list => (
                      <SelectItem key={list.id} value={String(list.id)}>
                        {list.name} ({formatNumber(list.voterCount)} voters)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                value={composeForm.subject}
                onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                placeholder="Your email subject"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Body</Label>
              <Textarea
                value={composeForm.body}
                onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                placeholder="Write your email content here...

Use {{first_name}} to personalize with the voter's first name."
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCampaignMutation.mutate(composeForm)}
              disabled={!composeForm.name || !composeForm.subject || !composeForm.body || !composeForm.listId || createCampaignMutation.isPending}
            >
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
