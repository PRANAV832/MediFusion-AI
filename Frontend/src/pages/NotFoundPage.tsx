import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { AlertCircle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-rose-400 mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold text-slate-100">404 — Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-400 max-w-md">
        The requested clinical resource or route does not exist or has not yet been unlocked in this phase.
      </p>
      <div className="mt-6">
        <Link to="/">
          <Button variant="default" className="gap-2">
            <Home className="h-4 w-4" />
            Return to Workstation Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
