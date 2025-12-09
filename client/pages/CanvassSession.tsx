import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { apiGet, apiPost } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  ArrowLeft, MapPin, ChevronLeft, ChevronRight, 
  Home, Check, X, Clock, Navigation 
} from 'lucide-react';
import { formatPhoneNumber, getSupportLevelColor, getSupportLevelLabel } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface CanvassVoter {
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

export function CanvassSession() {
  const [, params] = useRoute('/canvassing/:listId');
  const listId = params?.listId;
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [contactResult, setContactResult] = useState('');
  const [supportLevel, setSupportLevel] = useState('');
  const [notes, setNotes] = useState('');

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['lists', listId],
    queryFn: () => apiGet<{ success: boolean; data: ListInfo }>(`/lists/${listId}`),
    enabled: !!listId,
  });

  const { data: votersData, isLoading: votersLoading } = useQuery({
    queryKey: ['canvass', listId, 'voters'],
    queryFn: () => apiGet<{ success: boolean; data: CanvassVoter[] }>(
      `/lists/${listId}/voters?pageSize=1000`
    ),
    enabled: !!listId,
  });

  const logContactMutation = useMutation({
    mutationFn: (data: { voterId: number; result: string; supportLevel?: number; notes?: string }) =>
      apiPost('/interactions', {
        voterId: data.voterId,
        type: 'canvass',
        result: data.result,
        supportLevel: data.supportLevel,
        notes: data.notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvass', listId, 'voters'] });
      // Move to next
      if (currentIndex < voters.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
      resetForm();
      toast({ title: 'Contact logged' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to log contact.', variant: 'destructive' });
    },
  });

  const list = listData?.data;
  const allVoters = votersData?.data || [];
  // Filter to uncontacted voters
  const voters = allVoters.filter(v => !v.contacted);
  const currentVoter = voters[currentIndex];
  const completedCount = allVoters.filter(v => v.contacted).length;

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

  const openDirections = () => {
    if (!currentVoter) return;
    const address = encodeURIComponent(
      `${currentVoter.voter.address}, ${currentVoter.voter.city}, ${currentVoter.voter.zip}`
    );
    window.open(`https://maps.google.com/maps?q=${address}`, '_blank');
  };

  if (listLoading || votersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading canvass session...</div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-muted-foreground">List not found</div>
        <Link href="/canvassing">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Canvassing
          </Button>
        </Link>
      </div>
    );
  }

  if (voters.length === 0) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/canvassing">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{list.name}</h1>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">All done!</h3>
            <p className="text-muted-foreground mb-4">
              You've contacted all {completedCount} voters in this list.
            </p>
            <Link href="/canvassing">
              <Button>Back to Canvassing</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/canvassing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Exit
          </Button>
        </Link>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{list.name}</p>
          <p className="text-xs text-muted-foreground">
            {completedCount} of {allVoters.length} contacted
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
          {/* Address */}
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{currentVoter.voter.address}</p>
              <p className="text-sm text-muted-foreground">
                {currentVoter.voter.city}, {currentVoter.voter.zip}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openDirections}>
              <Navigation className="h-4 w-4" />
            </Button>
          </div>

          {/* Phone */}
          {currentVoter.voter.phone && (
            <div className="text-sm">
              <span className="text-muted-foreground">Phone: </span>
              <a href={`tel:${currentVoter.voter.phone}`} className="text-primary">
                {formatPhoneNumber(currentVoter.voter.phone)}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Record Response</CardTitle>
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
              Contact Made
            </Button>
            <Button
              variant={contactResult === 'not_home' ? 'default' : 'outline'}
              className="h-auto py-3"
              onClick={() => setContactResult('not_home')}
            >
              <Clock className="h-4 w-4 mr-2" />
              Not Home
            </Button>
            <Button
              variant={contactResult === 'refused' ? 'default' : 'outline'}
              className="h-auto py-3"
              onClick={() => setContactResult('refused')}
            >
              <X className="h-4 w-4 mr-2" />
              Refused
            </Button>
            <Button
              variant={contactResult === 'moved' ? 'default' : 'outline'}
              className="h-auto py-3"
              onClick={() => setContactResult('moved')}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Moved
            </Button>
          </div>

          {/* Support Level (if contact made) */}
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
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Strong Support</span>
                <span>Strong Against</span>
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
