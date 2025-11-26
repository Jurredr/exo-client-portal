import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Unauthorized Access
        </h1>
        <p className="text-white/80 mb-8">
          You don't have permission to view this project.
        </p>
        <Link
          href="/login"
          className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
