import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Project Not Found
        </h1>
        <p className="text-white/80 mb-8">
          The project you're looking for doesn't exist.
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
