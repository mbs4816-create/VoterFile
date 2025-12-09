import { Route, Switch } from 'wouter';
import { Toaster } from './components/ui/toaster';
import { useAuth } from './hooks/useAuth';

// Layout
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Voters } from './pages/Voters';
import { VoterDetail } from './pages/VoterDetail';
import { Lists } from './pages/Lists';
import { ListDetail } from './pages/ListDetail';
import { Canvassing } from './pages/Canvassing';
import { CanvassSession } from './pages/CanvassSession';
import { PhoneBank } from './pages/PhoneBank';
import { PhoneSession } from './pages/PhoneSession';
import { Email } from './pages/Email';
import { Scripts } from './pages/Scripts';
import { Import } from './pages/Import';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';

// Loading spinner
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">Loading VoterPulse...</p>
      </div>
    </div>
  );
}

function AuthenticatedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/voters" component={Voters} />
        <Route path="/voters/:id" component={VoterDetail} />
        <Route path="/lists" component={Lists} />
        <Route path="/lists/:id" component={ListDetail} />
        <Route path="/canvassing" component={Canvassing} />
        <Route path="/canvassing/:listId" component={CanvassSession} />
        <Route path="/phonebank" component={PhoneBank} />
        <Route path="/phonebank/:listId" component={PhoneSession} />
        <Route path="/email" component={Email} />
        <Route path="/scripts" component={Scripts} />
        <Route path="/import" component={Import} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function UnauthenticatedRoutes() {
  return (
    <AuthLayout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route>
          <Login />
        </Route>
      </Switch>
    </AuthLayout>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      {isAuthenticated ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />}
      <Toaster />
    </>
  );
}
