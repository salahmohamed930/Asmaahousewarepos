import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[ErrorBoundary] Caught runtime UI error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">حدث خطأ غير متوقع في واجهة النظام</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              تم حصر الخطأ بنجاح لحماية بياناتك المحلية والعمليات المسجلة. يمكنك إعادة تحميل الصفحة للعودة فوراً.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs text-rose-300 font-mono text-left mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/30"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة تشغيل وتحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

