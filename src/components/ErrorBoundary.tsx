import * as React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] h-full p-6 text-center bg-stone-900 text-stone-100 rounded-2xl m-4 border border-stone-800 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-100 mb-2">
            Ocurrió un detalle temporal en la vista
          </h2>
          <p className="text-sm text-stone-400 max-w-md mb-6 leading-relaxed">
            {this.state.error?.message?.includes("Quota") 
              ? "Límite de peticiones de red alcanzado temporalmente. Puedes seguir navegando o actualizar la vista."
              : "Se ha detectado una interrupción. Haz clic en el botón inferior para restaurar el módulo."}
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer"
          >
            <RefreshCw size={16} /> Reintentar Carga
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
