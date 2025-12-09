import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, Phone, MapPin, TrendingUp, Activity } from 'lucide-react';
import { formatNumber, formatRelativeTime, getSupportLevelColor, getSupportLevelLabel } from '../lib/utils';

interface DashboardMetrics {
  totalVoters: number;
  totalContacts: number;
  contactsThisWeek: number;
  supportDistribution: Record<string, number>;
}

interface ActivityItem {
  id: number;
  type: string;
  voterName: string;
  userName: string;
  result: string;
  createdAt: string;
}

interface TopList {
  id: number;
  name: string;
  voterCount: number;
  type: string;
}

export function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => apiGet<{ success: boolean; data: DashboardMetrics }>('/dashboard/metrics'),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => apiGet<{ success: boolean; data: ActivityItem[] }>('/dashboard/activity'),
  });

  const { data: topLists, isLoading: listsLoading } = useQuery({
    queryKey: ['dashboard', 'top-lists'],
    queryFn: () => apiGet<{ success: boolean; data: TopList[] }>('/dashboard/top-lists'),
  });

  const metricsData = metrics?.data;
  const activityData = activity?.data || [];
  const topListsData = topLists?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to VoterPulse. Here's your campaign overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Voters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? '...' : formatNumber(metricsData?.totalVoters)}
            </div>
            <p className="text-xs text-muted-foreground">In your database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? '...' : formatNumber(metricsData?.totalContacts)}
            </div>
            <p className="text-xs text-muted-foreground">All time interactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading ? '...' : formatNumber(metricsData?.contactsThisWeek)}
            </div>
            <p className="text-xs text-muted-foreground">Contacts made</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contact Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metricsLoading || !metricsData?.totalVoters 
                ? '...' 
                : `${((metricsData.totalContacts / metricsData.totalVoters) * 100).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">Of voters contacted</p>
          </CardContent>
        </Card>
      </div>

      {/* Support Distribution */}
      {metricsData?.supportDistribution && (
        <Card>
          <CardHeader>
            <CardTitle>Support Distribution</CardTitle>
            <CardDescription>Based on recorded support levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((level) => {
                const count = metricsData.supportDistribution[level] || 0;
                const total = Object.values(metricsData.supportDistribution).reduce((a, b) => a + b, 0);
                const percent = total > 0 ? (count / total) * 100 : 0;
                
                return (
                  <div key={level} className="flex-1 min-w-[120px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSupportLevelColor(level)}`}>
                        {getSupportLevelLabel(level)}
                      </span>
                      <span className="text-sm text-muted-foreground">{formatNumber(count)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getSupportLevelColor(level).split(' ')[0]}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest voter interactions</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : activityData.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No recent activity</div>
            ) : (
              <div className="space-y-4">
                {activityData.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {item.type === 'canvass' ? (
                        <MapPin className="h-4 w-4 text-primary" />
                      ) : (
                        <Phone className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{item.userName}</span>
                        {' '}contacted{' '}
                        <span className="font-medium">{item.voterName}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {item.result.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Lists */}
        <Card>
          <CardHeader>
            <CardTitle>Top Lists</CardTitle>
            <CardDescription>Most active voter lists</CardDescription>
          </CardHeader>
          <CardContent>
            {listsLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : topListsData.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No lists created yet</div>
            ) : (
              <div className="space-y-3">
                {topListsData.map((list, index) => (
                  <div key={list.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(list.voterCount)} voters • {list.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
