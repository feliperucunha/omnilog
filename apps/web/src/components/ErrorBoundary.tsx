import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/contexts/LocaleContext";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center p-6"
      style={{ minHeight: "60vh" }}
    >
      <Card className="max-w-[400px] border-[var(--color-dark)] bg-[var(--color-dark)] shadow-[var(--shadow-lg)]">
        <CardHeader>
          <h3 className="text-lg font-semibold text-[var(--color-lightest)]">
            {t("errorBoundary.title")}
          </h3>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-light)]">
            {error.message || t("errorBoundary.message")}
          </p>
          <Button
            className="bg-[var(--color-mid)] text-[var(--color-lightest)] hover:bg-[var(--color-light)]"
            onClick={onRetry}
          >
            {t("errorBoundary.retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}
