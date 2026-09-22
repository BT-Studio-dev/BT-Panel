export function BrandMark({
  className = "size-8",
  src,
}: {
  className?: string;
  /** Custom panel logo (URL, /path or data:image) — empty/omitted = built-in mark. */
  src?: string;
}) {
  return <img src={src || "/brand-mark.svg"} alt="" className={className} />;
}
