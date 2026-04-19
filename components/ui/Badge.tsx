import { HTMLAttributes } from "react";

type BadgeVariant = "success" | "error" | "info" | "neutral" | "warning";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-[#DEF7EC] text-[#03543F]",
  error:   "bg-[#FDE8E8] text-[#9B1C1C]",
  info:    "bg-[#EEF3FE] text-[#1E40AF]",
  neutral: "bg-[#F4F5F7] text-[#5A6070]",
  warning: "bg-[#FDF6B2] text-[#723B13]",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={[
        "inline-flex items-center text-[11px] font-semibold px-2 py-[2px] rounded-full",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
