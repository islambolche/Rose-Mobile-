import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ""
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center">
            <h1 className="text-xl font-bold text-red-500 mb-4">Something went wrong</h1>
            <p className="text-sm text-gray-400">{this.state.errorMsg}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
