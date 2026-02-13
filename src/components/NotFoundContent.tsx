import Image from "next/image";
import Link from "next/link";

const LOGO_SIZE = 164;
const CONTENT_WIDTH = 280;

export function NotFoundContent() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/bg-clear.jpg)" }}
    >
      <div
        className="flex flex-1 flex-col items-center justify-center text-center"
        style={{ width: CONTENT_WIDTH }}
      >
        <Image
          src="/exo-glass.png"
          alt="EXO"
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          className="shrink-0 object-contain"
          priority
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-sm text-gray-600 mb-6">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/login"
          className="w-full rounded-lg bg-[#1f1f1f] py-3 text-center text-sm font-medium text-white shadow-sm transition-opacity hover:bg-gray-800 focus:outline-none"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
