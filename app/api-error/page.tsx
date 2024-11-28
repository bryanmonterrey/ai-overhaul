export default function ApiError() {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Service Temporarily Unavailable</h1>
          <p>
            We're having trouble verifying token holdings. Please try again in a few minutes.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-black text-white rounded hover:bg-white/10 border border-white"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }