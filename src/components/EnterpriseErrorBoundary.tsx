import * as React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class EnterpriseErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('EnterpriseErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-zinc-950 text-zinc-100">
          <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Enterprise Recovery Protection</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              The application encountered an unexpected runtime exception. The security and data integrity layer has isolated the event.
            </p>
            {this.state.error && (
              <div className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg p-3 mb-6 text-left overflow-auto max-h-32">
                <p className="text-xs font-mono text-red-400 font-semibold break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={this.handleDismiss}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold transition-colors cursor-pointer"
              >
                Dismiss & Continue
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EnterpriseErrorBoundary;
