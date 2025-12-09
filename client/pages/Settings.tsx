import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/queryClient';
import { useAuth } from '../hooks/useAuth';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Settings as SettingsIcon,
  Users,
  Building2,
  Shield,
  Mail,
  Plus,
  Edit,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { formatDate } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface TeamMember {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'organizer' | 'volunteer';
  status: 'active' | 'pending' | 'inactive';
  lastActive?: string;
  createdAt: string;
}

interface Organization {
  id: number;
  name: string;
  slug: string;
  settings: {
    timezone: string;
    emailFromName: string;
    emailFromAddress: string;
    primaryColor: string;
  };
}

export function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'organization' | 'team' | 'security'>('organization');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'volunteer' as TeamMember['role'] });
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiGet<{ success: boolean; data: Organization }>('/organizations/current'),
  });

  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => apiGet<{ success: boolean; data: TeamMember[] }>('/organizations/team'),
  });

  const [orgForm, setOrgForm] = useState({
    name: '',
    timezone: 'America/Chicago',
    emailFromName: '',
    emailFromAddress: '',
    primaryColor: '#3b82f6',
  });

  // Update form when org data loads
  if (orgData?.data && orgForm.name === '') {
    const org = orgData.data;
    setOrgForm({
      name: org.name,
      timezone: org.settings?.timezone || 'America/Chicago',
      emailFromName: org.settings?.emailFromName || '',
      emailFromAddress: org.settings?.emailFromAddress || '',
      primaryColor: org.settings?.primaryColor || '#3b82f6',
    });
  }

  const updateOrgMutation = useMutation({
    mutationFn: (data: typeof orgForm) => apiPatch('/organizations/current', {
      name: data.name,
      settings: {
        timezone: data.timezone,
        emailFromName: data.emailFromName,
        emailFromAddress: data.emailFromAddress,
        primaryColor: data.primaryColor,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({ title: 'Settings saved', description: 'Organization settings have been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: typeof inviteForm) => apiPost('/organizations/team/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setShowInvite(false);
      setInviteForm({ email: '', role: 'volunteer' });
      toast({ title: 'Invitation sent', description: 'Team member has been invited.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send invitation.', variant: 'destructive' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: TeamMember['role'] }) =>
      apiPatch(`/organizations/team/${id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setEditingMember(null);
      toast({ title: 'Role updated', description: 'Team member role has been changed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update role.', variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/organizations/team/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast({ title: 'Member removed', description: 'Team member has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove member.', variant: 'destructive' });
    },
  });

  const org = orgData?.data;
  const team = teamData?.data || [];

  const getRoleBadge = (role: TeamMember['role']) => {
    switch (role) {
      case 'admin':
        return <Badge variant="destructive">Admin</Badge>;
      case 'organizer':
        return <Badge variant="default">Organizer</Badge>;
      case 'volunteer':
        return <Badge variant="secondary">Volunteer</Badge>;
    }
  };

  const getStatusBadge = (status: TeamMember['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const tabs = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your organization and team settings
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Organization Tab */}
      {activeTab === 'organization' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Basic information about your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orgLoading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input
                      value={orgForm.name}
                      onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                      placeholder="Your organization name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={orgForm.timezone}
                      onValueChange={(v) => setOrgForm({ ...orgForm, timezone: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>
                Configure how emails appear when sent from VoterPulse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={orgForm.emailFromName}
                    onChange={(e) => setOrgForm({ ...orgForm, emailFromName: e.target.value })}
                    placeholder="Your Campaign"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    value={orgForm.emailFromAddress}
                    onChange={(e) => setOrgForm({ ...orgForm, emailFromAddress: e.target.value })}
                    placeholder="outreach@yourcampaign.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Customize the appearance of your VoterPulse instance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={orgForm.primaryColor}
                    onChange={(e) => setOrgForm({ ...orgForm, primaryColor: e.target.value })}
                    className="h-10 w-20 rounded border cursor-pointer"
                  />
                  <Input
                    value={orgForm.primaryColor}
                    onChange={(e) => setOrgForm({ ...orgForm, primaryColor: e.target.value })}
                    className="w-32"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => updateOrgMutation.mutate(orgForm)}
              disabled={updateOrgMutation.isPending}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Team Members</h2>
              <p className="text-muted-foreground">
                Manage who has access to your organization
              </p>
            </div>
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Loading team members...
                    </TableCell>
                  </TableRow>
                ) : team.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No team members yet. Invite someone to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  team.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{getRoleBadge(member.role)}</TableCell>
                      <TableCell>{getStatusBadge(member.status)}</TableCell>
                      <TableCell>
                        {member.lastActive ? formatDate(member.lastActive) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.id !== user?.id && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingMember(member)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Remove ${member.name} from the team?`)) {
                                  removeMemberMutation.mutate(member.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
              <CardDescription>
                Overview of what each role can do in VoterPulse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead className="text-center">Admin</TableHead>
                    <TableHead className="text-center">Organizer</TableHead>
                    <TableHead className="text-center">Volunteer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: 'View voters', admin: true, organizer: true, volunteer: true },
                    { name: 'Log interactions', admin: true, organizer: true, volunteer: true },
                    { name: 'Create/manage lists', admin: true, organizer: true, volunteer: false },
                    { name: 'Import voters', admin: true, organizer: true, volunteer: false },
                    { name: 'Send emails', admin: true, organizer: true, volunteer: false },
                    { name: 'Manage scripts', admin: true, organizer: true, volunteer: false },
                    { name: 'View reports', admin: true, organizer: true, volunteer: false },
                    { name: 'Manage team', admin: true, organizer: false, volunteer: false },
                    { name: 'Organization settings', admin: true, organizer: false, volunteer: false },
                  ].map(perm => (
                    <TableRow key={perm.name}>
                      <TableCell>{perm.name}</TableCell>
                      <TableCell className="text-center">
                        {perm.admin ? '✓' : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {perm.organizer ? '✓' : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {perm.volunteer ? '✓' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Privacy</CardTitle>
              <CardDescription>
                Information about how voter data is protected
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Encrypted at Rest</p>
                  <p className="text-sm text-muted-foreground">
                    All voter data is encrypted using AES-256 encryption.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Secure Connections</p>
                  <p className="text-sm text-muted-foreground">
                    All data is transmitted over TLS 1.3 encrypted connections.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Access Logging</p>
                  <p className="text-sm text-muted-foreground">
                    All data access is logged and auditable.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={inviteForm.role}
                onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as TeamMember['role'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">Volunteer - Can log interactions</SelectItem>
                  <SelectItem value="organizer">Organizer - Can manage lists and campaigns</SelectItem>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteMutation.mutate(inviteForm)}
              disabled={!inviteForm.email || inviteMutation.isPending}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for {editingMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editingMember?.role}
                onValueChange={(v) => {
                  if (editingMember) {
                    updateRoleMutation.mutate({ id: editingMember.id, role: v as TeamMember['role'] });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
