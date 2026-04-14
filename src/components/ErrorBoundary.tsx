import React from 'react';
import { Link } from 'react-router-dom';

interface State {
  error: Error | null;
}

/**
 * Root error boundary. Catches uncaught render errors anywhere in the route
 * tree and shows a warm fallback instead of a white screen. Production
 * errors get logged to the console for now; once we add an observability
 * provider we can hook it up here.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Heritage Kitchen crashed:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta">
          Something burned on the stove
        </p>
        <h1 className="font-serif text-3xl">We're sorry.</h1>
        <p className="leading-relaxed text-muted">
          Something went wrong on our end. The page crashed before it could
          finish loading. Reloading usually helps &mdash; and if it doesn't,
          head back home and try a different dish.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Reload
          </button>
          <Link to="/" onClick={this.reset} className="btn">
            Go home
          </Link>
        </div>
        {import.meta.env.DEV && (
          <details className="mt-6 w-full text-left">
            <summary className="cursor-pointer text-xs text-muted">
              Error detail (dev only)
            </summary>
            <pre className="mt-2 overflow-auto rounded-xl bg-paper p-3 text-xs">
              {this.state.error.stack ?? this.state.error.message}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
