import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: ''
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : '页面渲染出现异常，请重试或返回首页。';

    return {
      hasError: true,
      message
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // 仅诊断用途；不向用户暴露堆栈。
    console.error('AppErrorBoundary caught', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-bg-main p-8 text-[#2F3440]"
      >
        <div className="w-full max-w-lg rounded-2xl border border-border-light bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold">页面出现问题</h1>
          <p className="mt-3 text-sm leading-6 text-[#5D6472]">{this.state.message}</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="h-10 rounded bg-meitu px-5 text-sm font-bold text-white hover:brightness-110"
            >
              重试
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="h-10 rounded border border-border-light bg-white px-5 text-sm font-bold text-[#515867] hover:border-meitu hover:text-meitu"
            >
              重新加载
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
