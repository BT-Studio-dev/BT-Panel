import { cn } from "@/lib/utils";

export function PresenceAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "size-24" : size === "sm" ? "size-9" : "size-10";
  const image = src && src.length > 0 ? src : "/avatar.svg";
  return (
    <div className={cn("relative shrink-0", dim)} title={name}>
      <div
        className={cn(
          "grid size-full place-items-center overflow-hidden rounded-[12px] bg-white/10",
          size === "lg" && "rounded-[22px]",
        )}
      >
        <img src={image} alt="" className="size-full object-cover" />
      </div>
    </div>
  );
}
