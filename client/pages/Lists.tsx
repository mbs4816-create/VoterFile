import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiGet, apiPost, apiDelete } from '../lib/queryClient';
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
import { Plus, Users, MapPin, Phone, Trash2 } from 'lucide-react';
import { formatNumber, formatDate } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface VoterList {
  id: number;
  name: string;
  description?: string;
  type: string;
  voterCount: number;
  createdAt: string;
  updatedAt: string;
}

export function Lists() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    type: 'canvass',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => apiGet<{ success: boolean; data: VoterList[] }>('/lists'),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => apiPost('/lists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setShowCreate(false);
      setCreateForm({ name: '', description: '', type: 'canvass' });
      toast({ title: 'List created', description: 'Your new list is ready to use.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create list.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      toast({ title: 'List deleted', description: 'The list has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete list.', variant: 'destructive' });
    },
  });

  const lists = data?.data || [];
  const canvassLists = lists.filter(l => l.type === 'canvass');
  const phoneLists = lists.filter(l => l.type === 'phone');
  const otherLists = lists.filter(l => !['canvass', 'phone'].includes(l.type));

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'canvass': return <MapPin className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'canvass': return <Badge variant="secondary">Canvass</Badge>;
      case 'phone': return <Badge variant="secondary">Phone</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const ListCard = ({ list }: { list: VoterList }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(list.type)}
            <CardTitle className="text-lg">{list.name}</CardTitle>
          </div>
          {getTypeBadge(list.type)}
        </div>
        {list.description && (
          <CardDescription className="line-clamp-2">{list.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{formatNumber(list.voterCount)}</p>
            <p className="text-xs text-muted-foreground">voters</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to delete this list?')) {
                  deleteMutation.mutate(list.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            <Link href={`/lists/${list.id}`}>
              <Button variant="outline" size="sm">View</Button>
            </Link>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Updated {formatDate(list.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Lists</h1>
          <p className="text-muted-foreground">
            Organize voters into lists for canvassing and phone banking
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create List
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading lists...</div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No lists yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first list to start organizing voters for outreach.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Canvass Lists */}
          {canvassLists.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Canvassing Lists
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {canvassLists.map(list => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            </div>
          )}

          {/* Phone Lists */}
          {phoneLists.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Phone Banking Lists
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {phoneLists.map(list => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            </div>
          )}

          {/* Other Lists */}
          {otherLists.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Other Lists
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherLists.map(list => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create List Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>
              Create a new list to organize voters for outreach activities.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">List Name</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g., Ward 5 Canvass"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">List Type</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) => setCreateForm({ ...createForm, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="canvass">Canvassing</SelectItem>
                  <SelectItem value="phone">Phone Banking</SelectItem>
                  <SelectItem value="email">Email Campaign</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Describe this list's purpose..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.name || createMutation.isPending}
            >
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
