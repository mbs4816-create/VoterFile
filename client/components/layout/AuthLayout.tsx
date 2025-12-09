interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-lg text-center text-primary-foreground">
          <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-white/10 flex items-center justify-center">
            <span className="text-5xl font-bold">V</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">VoterPulse</h1>
          <p className="text-xl opacity-90 mb-8">
            The modern political organizing CRM that helps you win elections.
          </p>
          <div className="grid grid-cols-2 gap-4 text-left text-sm opacity-80">
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Manage millions of voters</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Smart list building</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Mobile canvassing</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Phone banking</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Email campaigns</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1">✓</span>
              <span>Real-time analytics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-3xl">V</span>
            </div>
            <h1 className="text-2xl font-bold">VoterPulse</h1>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
