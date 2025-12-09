import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { apiGet, apiPost, apiPatch } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  ArrowLeft, Phone, Mail, MapPin, Calendar, User, 
  History, Edit2, Save, X 
} from 'lucide-react';
import { useState } from 'react';
import { toast } from '../hooks/useToast';
import { 
  formatDate, formatPhoneNumber, formatRelativeTime,
  getSupportLevelColor, getSupportLevelLabel, getInteractionResultColor 
} from '../lib/utils';

interface VoterDetail {
  id: number;
  stateVoterId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  phone?: string;
  email?: string;
  congressionalDistrict?: string;
  stateSenateDistrict?: string;
  stateHouseDistrict?: string;
  precinct?: string;
  ward?: string;
  registrationDate?: string;
  partyAffiliation?: string;
  supportLevel?: number;
  notes?: string;
}

interface Interaction {
  id: number;
  type: string;
  result: string;
  supportLevel?: number;
  notes?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string };
}

export function VoterDetail() {
  const [, params] = useRoute('/voters/:id');
  const voterId = params?.id;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<VoterDetail>>({});
  const [showLogContact, setShowLogContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    type: 'phone',
    result: 'contact_made',
    supportLevel: '',
    notes: '',
  });

  const { data: voterData, isLoading: voterLoading } = useQuery({
    queryKey: ['voters', voterId],
    queryFn: () => apiGet<{ success: boolean; data: VoterDetail }>(`/voters/${voterId}`),
    enabled: !!voterId,
  });

  const { data: interactionsData, isLoading: interactionsLoading } = useQuery({
    queryKey: ['voters', voterId, 'interactions'],
    queryFn: () => apiGet<{ success: boolean; data: Interaction[] }>(`/voters/${voterId}/interactions`),
    enabled: !!voterId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<VoterDetail>) => apiPatch(`/voters/${voterId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voters', voterId] });
      setEditing(false);
      toast({ title: 'Voter updated', description: 'Changes saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update voter.', variant: 'destructive' });
    },
  });

  const logContactMutation = useMutation({
    mutationFn: (data: typeof contactForm) => apiPost(`/interactions`, {
      voterId: parseInt(voterId!, 10),
      type: data.type,
      result: data.result,
      supportLevel: data.supportLevel ? parseInt(data.supportLevel, 10) : undefined,
      notes: data.notes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voters', voterId] });
      queryClient.invalidateQueries({ queryKey: ['voters', voterId, 'interactions'] });
      setShowLogContact(false);
      setContactForm({ type: 'phone', result: 'contact_made', supportLevel: '', notes: '' });
      toast({ title: 'Contact logged', description: 'Interaction recorded successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to log contact.', variant: 'destructive' });
    },
  });

  const voter = voterData?.data;
  const interactions = interactionsData?.data || [];

  if (voterLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading voter details...</div>
      </div>
    );
  }

  if (!voter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-muted-foreground">Voter not found</div>
        <Link href="/voters">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Voters
          </Button>
        </Link>
      </div>
    );
  }

  const startEditing = () => {
    setEditData({
      phone: voter.phone,
      email: voter.email,
      notes: voter.notes,
    });
    setEditing(true);
  };

  const saveEdits = () => {
    updateMutation.mutate(editData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/voters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {voter.firstName} {voter.middleName} {voter.lastName} {voter.suffix}
          </h1>
          <p className="text-muted-foreground">Voter ID: {voter.stateVoterId}</p>
        </div>
        <div className="flex items-center gap-2">
          {voter.supportLevel && (
            <Badge className={getSupportLevelColor(voter.supportLevel)}>
              {getSupportLevelLabel(voter.supportLevel)}
            </Badge>
          )}
          {!editing ? (
            <Button variant="outline" onClick={startEditing}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={saveEdits} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Phone
                  </Label>
                  {editing ? (
                    <Input
                      value={editData.phone || ''}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <p>{voter.phone ? formatPhoneNumber(voter.phone) : '—'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  {editing ? (
                    <Input
                      type="email"
                      value={editData.email || ''}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      placeholder="Enter email"
                    />
                  ) : (
                    <p>{voter.email || '—'}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Address
                </Label>
                <p>{voter.address || '—'}</p>
                <p className="text-sm text-muted-foreground">
                  {voter.city}, {voter.state} {voter.zip}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Demographics */}
          <Card>
            <CardHeader>
              <CardTitle>Demographics & Districts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{voter.dateOfBirth ? formatDate(voter.dateOfBirth) : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gender</p>
                  <p className="font-medium">{voter.gender || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Party</p>
                  <p className="font-medium">{voter.partyAffiliation || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Congressional District</p>
                  <p className="font-medium">{voter.congressionalDistrict ? `CD-${voter.congressionalDistrict}` : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">State Senate</p>
                  <p className="font-medium">{voter.stateSenateDistrict || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">State House</p>
                  <p className="font-medium">{voter.stateHouseDistrict || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Precinct</p>
                  <p className="font-medium">{voter.precinct || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ward</p>
                  <p className="font-medium">{voter.ward || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">County</p>
                  <p className="font-medium">{voter.county || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={editData.notes || ''}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Add notes about this voter..."
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {voter.notes || 'No notes yet.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => setShowLogContact(true)}>
                <Phone className="h-4 w-4 mr-2" />
                Log Contact
              </Button>
              {voter.phone && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={`tel:${voter.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call {formatPhoneNumber(voter.phone)}
                  </a>
                </Button>
              )}
              {voter.email && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={`mailto:${voter.email}`}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Log Contact Form */}
          {showLogContact && (
            <Card>
              <CardHeader>
                <CardTitle>Log Contact</CardTitle>
                <CardDescription>Record an interaction with this voter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Contact Type</Label>
                  <Select
                    value={contactForm.type}
                    onValueChange={(v) => setContactForm({ ...contactForm, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone Call</SelectItem>
                      <SelectItem value="canvass">Door Knock</SelectItem>
                      <SelectItem value="text">Text Message</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Result</Label>
                  <Select
                    value={contactForm.result}
                    onValueChange={(v) => setContactForm({ ...contactForm, result: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact_made">Contact Made</SelectItem>
                      <SelectItem value="not_home">Not Home</SelectItem>
                      <SelectItem value="voicemail">Voicemail</SelectItem>
                      <SelectItem value="refused">Refused</SelectItem>
                      <SelectItem value="wrong_number">Wrong Number</SelectItem>
                      <SelectItem value="moved">Moved</SelectItem>
                      <SelectItem value="deceased">Deceased</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {contactForm.result === 'contact_made' && (
                  <div className="space-y-2">
                    <Label>Support Level</Label>
                    <Select
                      value={contactForm.supportLevel}
                      onValueChange={(v) => setContactForm({ ...contactForm, supportLevel: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select support level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Strong Support</SelectItem>
                        <SelectItem value="2">2 - Lean Support</SelectItem>
                        <SelectItem value="3">3 - Undecided</SelectItem>
                        <SelectItem value="4">4 - Lean Against</SelectItem>
                        <SelectItem value="5">5 - Strong Against</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={contactForm.notes}
                    onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                    placeholder="Add notes about this contact..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowLogContact(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => logContactMutation.mutate(contactForm)}
                    disabled={logContactMutation.isPending}
                  >
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Contact History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {interactionsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : interactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {interactions.map((interaction) => (
                    <div key={interaction.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className={getInteractionResultColor(interaction.result)}>
                          {interaction.result.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(interaction.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm capitalize">{interaction.type}</p>
                      {interaction.supportLevel && (
                        <p className="text-xs text-muted-foreground">
                          Support: {getSupportLevelLabel(interaction.supportLevel)}
                        </p>
                      )}
                      {interaction.notes && (
                        <p className="text-sm mt-1 text-muted-foreground">{interaction.notes}</p>
                      )}
                      {interaction.user && (
                        <p className="text-xs text-muted-foreground mt-1">
                          by {interaction.user.firstName} {interaction.user.lastName}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
