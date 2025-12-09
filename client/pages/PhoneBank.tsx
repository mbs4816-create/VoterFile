import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiGet } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Phone, Users, Play, Clock } from 'lucide-react';
import { formatNumber, formatDate } from '../lib/utils';

interface PhoneList {
  id: number;
  name: string;
  description?: string;
  voterCount: number;
  contactedCount: number;
  updatedAt: string;
}

export function PhoneBank() {
  const { data, isLoading } = useQuery({
    queryKey: ['lists', 'phone'],
    queryFn: () => apiGet<{ success: boolean; data: PhoneList[] }>('/lists?type=phone'),
  });

  const lists = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8" />
            Phone Banking
          </h1>
          <p className="text-muted-foreground">
            Make calls efficiently with scripts and one-click logging
          </p>
        </div>
        <Link href="/lists">
          <Button variant="outline">Manage Lists</Button>
        </Link>
      </div>

      {/* Tips Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Tips for Effective Phone Banking</h3>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Use the provided script as a guide, not a word-for-word read</li>
                <li>• Be friendly and conversational</li>
                <li>• Keep calls under 3 minutes when possible</li>
                <li>• Log every call attempt immediately</li>
                <li>• Take breaks every 30-45 minutes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lists */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading phone lists...</div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No phone lists yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a phone banking list to start making calls.
            </p>
            <Link href="/lists">
              <Button>Create Phone List</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lists.map(list => {
            const progress = list.voterCount > 0 
              ? (list.contactedCount / list.voterCount) * 100 
              : 0;
            
            return (
              <Card key={list.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{list.name}</CardTitle>
                    <Badge variant={progress === 100 ? 'success' : 'secondary'}>
                      {progress.toFixed(0)}% done
                    </Badge>
                  </div>
                  {list.description && (
                    <CardDescription className="line-clamp-2">
                      {list.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{formatNumber(list.contactedCount)} called</span>
                      <span>{formatNumber(list.voterCount - list.contactedCount)} remaining</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {formatNumber(list.voterCount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDate(list.updatedAt)}
                      </span>
                    </div>
                    <Link href={`/phonebank/${list.id}`}>
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
