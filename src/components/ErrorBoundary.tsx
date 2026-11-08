import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-left overflow-y-auto">
            <h1 className="text-xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-sm text-gray-400 mb-2">{this.state.error?.message}</p>
            <pre className="text-[10px] text-red-300 bg-gray-900 p-4 rounded w-full overflow-x-auto">
                {this.state.errorInfo?.componentStack}
            </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
