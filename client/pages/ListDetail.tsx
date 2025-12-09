import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { apiGet, apiPost, apiDelete } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { 
  ArrowLeft, Users, Play, Plus, Trash2, Search, Filter,
  ChevronLeft, ChevronRight, MapPin, Phone
} from 'lucide-react';
import { formatNumber, formatPhoneNumber, getSupportLevelColor, getSupportLevelLabel } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface ListDetail {
  id: number;
  name: string;
  description?: string;
  type: string;
  voterCount: number;
}

interface ListVoter {
  id: number;
  voterId: number;
  voter: {
    id: number;
    firstName: string;
    lastName: string;
    address?: string;
    city?: string;
    zip?: string;
    phone?: string;
    supportLevel?: number;
  };
  contacted: boolean;
  result?: string;
}

export function ListDetail() {
  const [, params] = useRoute('/lists/:id');
  const listId = params?.id;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAddVoters, setShowAddVoters] = useState(false);
  const [addFilters, setAddFilters] = useState({
    city: '',
    zip: '',
    congressionalDistrict: '',
    supportLevel: '',
  });
  const pageSize = 25;

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['lists', listId],
    queryFn: () => apiGet<{ success: boolean; data: ListDetail }>(`/lists/${listId}`),
    enabled: !!listId,
  });

  const { data: votersData, isLoading: votersLoading } = useQuery({
    queryKey: ['lists', listId, 'voters', page],
    queryFn: () => apiGet<{ success: boolean; data: ListVoter[]; pagination: any }>(
      `/lists/${listId}/voters?page=${page}&pageSize=${pageSize}`
    ),
    enabled: !!listId,
  });

  const addVotersMutation = useMutation({
    mutationFn: (filters: typeof addFilters) => apiPost(`/lists/${listId}/populate`, { filters }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      setShowAddVoters(false);
      setAddFilters({ city: '', zip: '', congressionalDistrict: '', supportLevel: '' });
      toast({ 
        title: 'Voters added', 
        description: `${data.addedCount || 'Voters'} added to the list.` 
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add voters.', variant: 'destructive' });
    },
  });

  const removeVoterMutation = useMutation({
    mutationFn: (voterId: number) => apiDelete(`/lists/${listId}/voters/${voterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists', listId] });
      toast({ title: 'Voter removed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove voter.', variant: 'destructive' });
    },
  });

  const list = listData?.data;
  const voters = votersData?.data || [];
  const pagination = votersData?.pagination || { page: 1, total: 0, totalPages: 0 };

  if (listLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading list...</div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-muted-foreground">List not found</div>
        <Link href="/lists">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lists
          </Button>
        </Link>
      </div>
    );
  }

  const getStartLink = () => {
    switch (list.type) {
      case 'canvass': return `/canvassing/${listId}`;
      case 'phone': return `/phonebank/${listId}`;
      default: return `/lists/${listId}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/lists">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{list.name}</h1>
            <Badge variant="secondary">{list.type}</Badge>
          </div>
          {list.description && (
            <p className="text-muted-foreground">{list.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowAddVoters(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Voters
          </Button>
          {list.type === 'canvass' && (
            <Link href={getStartLink()}>
              <Button>
                <MapPin className="h-4 w-4 mr-2" />
                Start Canvassing
              </Button>
            </Link>
          )}
          {list.type === 'phone' && (
            <Link href={getStartLink()}>
              <Button>
                <Phone className="h-4 w-4 mr-2" />
                Start Calling
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatNumber(list.voterCount)}</div>
            <p className="text-xs text-muted-foreground">Total Voters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatNumber(voters.filter(v => v.contacted).length)}
            </div>
            <p className="text-xs text-muted-foreground">Contacted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {formatNumber(voters.filter(v => !v.contacted).length)}
            </div>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {list.voterCount > 0 
                ? `${((voters.filter(v => v.contacted).length / list.voterCount) * 100).toFixed(1)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">Completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Voters Table */}
      <Card>
        <CardHeader>
          <CardTitle>Voters in List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {votersLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading voters...</div>
          ) : voters.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No voters in this list</h3>
              <p className="text-muted-foreground mb-4">
                Add voters to get started with your outreach.
              </p>
              <Button onClick={() => setShowAddVoters(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Voters
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Support</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voters.map((listVoter) => (
                    <TableRow key={listVoter.id}>
                      <TableCell>
                        <Link href={`/voters/${listVoter.voter.id}`}>
                          <span className="font-medium hover:text-primary cursor-pointer">
                            {listVoter.voter.firstName} {listVoter.voter.lastName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{listVoter.voter.address}</p>
                        <p className="text-xs text-muted-foreground">
                          {listVoter.voter.city} {listVoter.voter.zip}
                        </p>
                      </TableCell>
                      <TableCell>
                        {listVoter.voter.phone 
                          ? formatPhoneNumber(listVoter.voter.phone)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {listVoter.voter.supportLevel ? (
                          <Badge className={getSupportLevelColor(listVoter.voter.supportLevel)}>
                            {getSupportLevelLabel(listVoter.voter.supportLevel)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Unknown</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {listVoter.contacted ? (
                          <Badge variant="success">Contacted</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVoterMutation.mutate(listVoter.voter.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Voters Dialog */}
      <Dialog open={showAddVoters} onOpenChange={setShowAddVoters}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Voters to List</DialogTitle>
            <DialogDescription>
              Filter voters to add to this list based on criteria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={addFilters.city}
                onChange={(e) => setAddFilters({ ...addFilters, city: e.target.value })}
                placeholder="e.g., Minneapolis"
              />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input
                value={addFilters.zip}
                onChange={(e) => setAddFilters({ ...addFilters, zip: e.target.value })}
                placeholder="e.g., 55401"
              />
            </div>
            <div className="space-y-2">
              <Label>Congressional District</Label>
              <Input
                value={addFilters.congressionalDistrict}
                onChange={(e) => setAddFilters({ ...addFilters, congressionalDistrict: e.target.value })}
                placeholder="e.g., 5"
              />
            </div>
            <div className="space-y-2">
              <Label>Support Level</Label>
              <Select
                value={addFilters.supportLevel}
                onValueChange={(v) => setAddFilters({ ...addFilters, supportLevel: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="1">Strong Support (1)</SelectItem>
                  <SelectItem value="2">Lean Support (2)</SelectItem>
                  <SelectItem value="3">Undecided (3)</SelectItem>
                  <SelectItem value="4">Lean Against (4)</SelectItem>
                  <SelectItem value="5">Strong Against (5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVoters(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addVotersMutation.mutate(addFilters)}
              disabled={addVotersMutation.isPending}
            >
              Add Matching Voters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
