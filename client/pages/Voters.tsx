import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiGet } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber, getSupportLevelColor, getSupportLevelLabel, formatPhoneNumber } from '../lib/utils';

interface Voter {
  id: number;
  stateVoterId: string;
  firstName: string;
  lastName: string;
  city: string;
  zip: string;
  phone: string | null;
  email: string | null;
  supportLevel: number | null;
  congressionalDistrict: string | null;
}

interface VotersResponse {
  success: boolean;
  data: Voter[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function Voters() {
  const [search, setSearch] = useState('');
  const [supportFilter, setSupportFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading, error } = useQuery({
    queryKey: ['voters', { search, supportFilter, page, pageSize }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);
      if (supportFilter !== 'all') params.set('supportLevel', supportFilter);
      return apiGet<VotersResponse>(`/voters?${params}`);
    },
  });

  const voters = data?.data || [];
  const pagination = data?.pagination || { page: 1, pageSize, total: 0, totalPages: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Voters</h1>
          <p className="text-muted-foreground">
            Search and manage your voter database
          </p>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, address, or voter ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                value={supportFilter}
                onValueChange={(value) => {
                  setSupportFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Support Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="1">Strong Support (1)</SelectItem>
                  <SelectItem value="2">Lean Support (2)</SelectItem>
                  <SelectItem value="3">Undecided (3)</SelectItem>
                  <SelectItem value="4">Lean Against (4)</SelectItem>
                  <SelectItem value="5">Strong Against (5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {isLoading ? 'Loading...' : `${formatNumber(pagination.total)} voters found`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-8 text-center text-destructive">
              Failed to load voters. Please try again.
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading voters...
            </div>
          ) : voters.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No voters found matching your criteria.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Support</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {voters.map((voter) => (
                      <TableRow key={voter.id}>
                        <TableCell>
                          <Link href={`/voters/${voter.id}`}>
                            <span className="font-medium hover:text-primary cursor-pointer">
                              {voter.firstName} {voter.lastName}
                            </span>
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            ID: {voter.stateVoterId}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>{voter.city}</p>
                          <p className="text-xs text-muted-foreground">
                            {voter.zip} {voter.congressionalDistrict && `• CD-${voter.congressionalDistrict}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          {voter.phone && <p>{formatPhoneNumber(voter.phone)}</p>}
                          {voter.email && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {voter.email}
                            </p>
                          )}
                          {!voter.phone && !voter.email && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {voter.supportLevel ? (
                            <Badge className={getSupportLevelColor(voter.supportLevel)}>
                              {getSupportLevelLabel(voter.supportLevel)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Unknown</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/voters/${voter.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, pagination.total)} of {formatNumber(pagination.total)}
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
                  <span className="text-sm">
                    Page {page} of {pagination.totalPages}
                  </span>
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
    </div>
  );
}
