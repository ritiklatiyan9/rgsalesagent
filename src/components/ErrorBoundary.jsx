import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught error in component tree:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border rounded-md p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">An error occurred while loading the app. See console for details.</p>
            <pre className="text-xs text-left max-h-40 overflow-auto bg-slate-100 dark:bg-slate-800 p-2 rounded font-mono mb-4">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <div className="mt-4 flex justify-center gap-2">
              <button
                className="px-3 py-1.5 rounded border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => location.reload()}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
