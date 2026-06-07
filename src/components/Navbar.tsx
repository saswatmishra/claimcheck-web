import { Link } from "react-router-dom";
import logoIcon from "../assets/logo-icon.svg";

export default function Navbar() {
  return (
    <nav className="w-full border-b bg-white h-16">
      <div className="max-w-5xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoIcon}
            alt="ClaimCheck"
            className="
              h-10 w-10 object-contain
              logo-pop
              transition
              hover:drop-shadow-[0_0_10px_rgba(34,197,94,0.35)]
            "
          />
          <span className="font-semibold text-slate-900 text-lg">
            ClaimCheck
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-500 sm:block">
            Insurance Claim Readiness
          </span>
          <Link
            to="/privacy"
            className="text-sm font-medium text-slate-600 hover:text-slate-950"
          >
            Privacy
          </Link>
        </div>
      </div>
    </nav>
  );
}
