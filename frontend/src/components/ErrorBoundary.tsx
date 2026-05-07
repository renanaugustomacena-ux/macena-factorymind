import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Boundary che cattura errori di rendering nei discendenti e mostra una UI
 * di fallback italiana, senza mai far crashare l'intera SPA.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <PaginaContenuto />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In produzione, la telemetria frontend può intercettare qui.
    type ErrorSinkWindow = Window & { __FM_ERROR_SINK?: (e: Error, i: ErrorInfo) => void };
    if (typeof window !== 'undefined') {
      const sink = (window as unknown as ErrorSinkWindow).__FM_ERROR_SINK;
      if (typeof sink === 'function') sink(error, info);
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div
        role="alert"
        className="mx-auto max-w-2xl px-6 py-12 text-center text-steel-800"
      >
        <h2 className="text-xl font-semibold mb-3">
          Si &egrave; verificato un errore imprevisto
        </h2>
        <p className="text-sm text-steel-600 mb-6">
          La pagina non pu&ograve; essere visualizzata correttamente. I dati della
          dashboard restano al sicuro. Pu&ograve; riprovare oppure ricaricare il
          browser.
        </p>
        <pre className="text-xs text-left bg-steel-50 rounded-md p-3 overflow-auto mb-6 max-h-48">
          {import.meta.env.PROD
            ? 'Dettagli tecnici nascosti in produzione. La segnalazione è stata registrata.'
            : error.message}
        </pre>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={this.reset}
            className="px-4 py-2 rounded-md bg-steel-900 text-white text-sm hover:bg-steel-700"
          >
            Riprova
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md bg-white border border-steel-300 text-sm hover:bg-steel-50"
          >
            Ricarica pagina
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
