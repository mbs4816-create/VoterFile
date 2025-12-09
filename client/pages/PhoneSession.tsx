import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { apiGet, apiPost } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { 
  ArrowLeft, Phone, ChevronLeft, ChevronRight, 
  Check, X, Voicemail, PhoneOff, User
} from 'lucide-react';
import { formatPhoneNumber, getSupportLevelColor, getSupportLevelLabel } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface PhoneVoter {
  id: number;
  voterId: number;
  contacted: boolean;
  voter: {
    id: number;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    zip: string;
    phone?: string;
    supportLevel?: number;
  };
}

interface ListInfo {
  id: number;
  name: string;
  voterCount: number;
}

interface Script {
  id: number;
  name: string;
  content: string;
}

export function PhoneSession() {
  const [, params] = useRoute('/phonebank/:listId');
  const listId = params?.listId;
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [contactResult, setContactResult] = useState('');
  const [supportLevel, setSupportLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [showScript, setShowScript] = useState(true);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['lists', listId],
    queryFn: () => apiGet<{ success: boolean; data: ListInfo }>(`/lists/${listId}`),
    enabled: !!listId,
  });

  const { data: votersData, isLoading: votersLoading } = useQuery({
    queryKey: ['phonebank', listId, 'voters'],
    queryFn: () => apiGet<{ success: boolean; data: PhoneVoter[] }>(
      `/lists/${listId}/voters?pageSize=1000`
    ),
    enabled: !!listId,
  });

  const { data: scriptsData } = useQuery({
    queryKey: ['scripts', 'phone'],
    queryFn: () => apiGet<{ success: boolean; data: Script[] }>('/scripts?type=phone'),
  });

  const logContactMutation = useMutation({
    mutationFn: (data: { voterId: number; result: string; supportLevel?: number; notes?: string }) =>
      apiPost('/interactions', {
        voterId: data.voterId,
        type: 'phone',
        result: data.result,
        supportLevel: data.supportLevel,
        notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phonebank', listId, 'voters'] });
      if (currentIndex < voters.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
      resetForm();
      toast({ title: 'Call logged' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to log call.', variant: 'destructive' });
    },
  });

  const list = listData?.data;
  const allVoters = votersData?.data || [];
  // Filter to voters with phone numbers who haven't been contacted
  const voters = allVoters.filter(v => !v.contacted && v.voter.phone);
  const currentVoter = voters[currentIndex];
  const completedCount = allVoters.filter(v => v.contacted).length;
  const scripts = scriptsData?.data || [];
  const currentScript = scripts[0];

  const resetForm = () => {
    setContactResult('');
    setSupportLevel('');
    setNotes('');
  };

  const handleSubmit = () => {
    if (!currentVoter || !contactResult) return;
    
    logContactMutation.mutate({
      voterId: currentVoter.voter.id,
      result: contactResult,
      supportLevel: supportLevel ? parseInt(supportLevel, 10) : undefined,
      notes: notes || undefined,
    });
  };

  if (listLoading || votersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading phone session...</div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-muted-foreground">List not found</div>
        <Link href="/phonebank">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Phone Bank
          </Button>
        </Link>
      </div>
    );
  }

  if (voters.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/phonebank">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{list.name}</h1>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">All calls complete!</h3>
            <p className="text-muted-foreground mb-4">
              You've called all {completedCount} voters with phone numbers in this list.
            </p>
            <Link href="/phonebank">
              <Button>Back to Phone Bank</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/phonebank">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Exit
          </Button>
        </Link>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{list.name}</p>
          <p className="text-xs text-muted-foreground">
            {completedCount} of {allVoters.length} called
          </p>
        </div>
        <Badge variant="secondary">
          {currentIndex + 1} / {voters.length}
        </Badge>
      </div>

      {/* Progress */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all"
          style={{ width: `${(completedCount / allVoters.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Voter Info & Dialer */}
        <div className="space-y-4">
          {/* Voter Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">
                    {currentVoter.voter.firstName} {currentVoter.voter.lastName}
                  </CardTitle>
                  {currentVoter.voter.supportLevel && (
                    <Badge className={`mt-1 ${getSupportLevelColor(currentVoter.voter.supportLevel)}`}>
                      {getSupportLevelLabel(currentVoter.voter.supportLevel)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Phone */}
              <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
                <Phone className="h-6 w-6 text-primary" />
                <div className="flex-1">
                  <p className="text-2xl font-bold">
                    {formatPhoneNumber(currentVoter.voter.phone!)}
                  </p>
                </div>
                <Button asChild>
                  <a href={`tel:${currentVoter.voter.phone}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </a>
                </Button>
              </div>

              {/* Address */}
              <div className="text-sm text-muted-foreground">
                <p>{currentVoter.voter.address}</p>
                <p>{currentVoter.voter.city}, {currentVoter.voter.zip}</p>
              </div>
            </CardContent>
          </Card>

          {/* Response Form */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Log Call Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Result Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={contactResult === 'contact_made' ? 'default' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setContactResult('contact_made')}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Spoke
                </Button>
                <Button
                  variant={contactResult === 'voicemail' ? 'default' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setContactResult('voicemail')}
                >
                  <Voicemail className="h-4 w-4 mr-2" />
                  Voicemail
                </Button>
                <Button
                  variant={contactResult === 'wrong_number' ? 'default' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setContactResult('wrong_number')}
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Wrong #
                </Button>
                <Button
                  variant={contactResult === 'refused' ? 'default' : 'outline'}
                  className="h-auto py-3"
                  onClick={() => setContactResult('refused')}
                >
                  <X className="h-4 w-4 mr-2" />
                  Refused
                </Button>
              </div>

              {/* Support Level */}
              {contactResult === 'contact_made' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Support Level</label>
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <Button
                        key={level}
                        variant={supportLevel === String(level) ? 'default' : 'outline'}
                        size="sm"
                        className={supportLevel === String(level) ? getSupportLevelColor(level) : ''}
                        onClick={() => setSupportLevel(String(level))}
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <Textarea
                placeholder="Add notes (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />

              {/* Submit */}
              <Button 
                className="w-full" 
                disabled={!contactResult || logContactMutation.isPending}
                onClick={handleSubmit}
              >
                Save & Next
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Script */}
        <div>
          <Card className="sticky top-20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {currentScript?.name || 'Phone Script'}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowScript(!showScript)}
                >
                  {showScript ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showScript && (
              <CardContent>
                {currentScript ? (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: currentScript.content
                        .replace(/\[NAME\]/g, `<strong>${currentVoter.voter.firstName}</strong>`)
                    }}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground space-y-4">
                    <p><strong>Hello, may I speak with {currentVoter.voter.firstName}?</strong></p>
                    <p>Hi {currentVoter.voter.firstName}, my name is [YOUR NAME] and I'm calling on behalf of [CAMPAIGN].</p>
                    <p>I'm reaching out to voters in your area to talk about [ISSUE/CANDIDATE].</p>
                    <p>Do you have a moment to share your thoughts?</p>
                    <hr />
                    <p className="text-xs">
                      <Link href="/scripts" className="text-primary">
                        Create a custom script →
                      </Link>
                    </p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentIndex === 0}
          onClick={() => {
            setCurrentIndex(currentIndex - 1);
            resetForm();
          }}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={currentIndex >= voters.length - 1}
          onClick={() => {
            setCurrentIndex(currentIndex + 1);
            resetForm();
          }}
        >
          Skip
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
