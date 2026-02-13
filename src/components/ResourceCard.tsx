import Image from "next/image";

interface ResourceCardProps {
  type: "folder" | "file";
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: "success" | "warning";
  };
  className?: string;
  onClick?: () => void;
  href?: string;
}

const ICONS = {
  folder: "/macos-folder-blue512x512@2x.png",
  file: "/file-sheet.png",
} as const;

export function ResourceCard({
  type,
  title,
  subtitle,
  badge,
  className = "",
  onClick,
  href,
}: ResourceCardProps) {
  const baseClassName = `flex w-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50/80 py-3 transition-colors hover:bg-gray-100 ${className}`;

  const content = (
    <>
      <div className="mb-2 flex h-18 w-18 relative items-center justify-center">
        <Image
          src={ICONS[type]}
          alt=""
          layout="fill"
          className="object-contain"
        />
      </div>
      <p className="text-center font-sans text-xs font-medium text-gray-700">
        {title}
      </p>
      {subtitle && (
        <p className="mt-1 font-sans text-[10px] text-gray-500">{subtitle}</p>
      )}
      {badge && (
        <span
          className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 font-sans text-[10px] font-semibold ${
            badge.variant === "warning"
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {badge.text}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClassName}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={baseClassName}
      onClick={onClick}
      onKeyDown={(e) =>
        onClick && (e.key === "Enter" || e.key === " ") && onClick()
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {content}
    </div>
  );
}
