import { Link } from "@tanstack/react-router";
import logo from "@/assets/moveeasy-logo-full.png";

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = size === "sm" ? 28 : size === "lg" ? 56 : 40;
  return (
    <Link to="/" className="flex items-center gap-2 group" aria-label="MoveEasy home">
      <img
        src={logo}
        alt="MoveEasy — Professional Home and Office Movers"
        height={h}
        style={{ height: h, width: "auto" }}
        className="transition-transform group-hover:scale-[1.03] select-none"
        draggable={false}
      />
    </Link>
  );
}
