import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiGet } from '../lib/queryClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { MapPin, Users, Play, Clock } from 'lucide-react';
import { formatNumber, formatDate } from '../lib/utils';

interface CanvassList {
  id: number;
  name: string;
  description?: string;
  voterCount: number;
  contactedCount: number;
  updatedAt: string;
}

export function Canvassing() {
  const { data, isLoading } = useQuery({
    queryKey: ['lists', 'canvass'],
    queryFn: () => apiGet<{ success: boolean; data: CanvassList[] }>('/lists?type=canvass'),
  });

  const lists = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MapPin className="h-8 w-8" />
            Canvassing
          </h1>
          <p className="text-muted-foreground">
            Go door-to-door with optimized walk lists and mobile-friendly interfaces
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
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Tips for Effective Canvassing</h3>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Work in pairs for safety and efficiency</li>
                <li>• Use the mobile interface on your phone at each door</li>
                <li>• Record every contact attempt, even "not home"</li>
                <li>• Be respectful and keep conversations brief</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lists */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading canvass lists...</div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No canvass lists yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a canvassing list to start door-knocking.
            </p>
            <Link href="/lists">
              <Button>Create Canvass List</Button>
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
                      <span>{formatNumber(list.contactedCount)} contacted</span>
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
                    <Link href={`/canvassing/${list.id}`}>
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
