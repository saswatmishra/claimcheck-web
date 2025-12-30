import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-bold text-slate-900 text-center">
        Will your insurance work when you need it?
      </h1>

      <p className="mt-4 text-slate-600 text-center max-w-xl">
        ClaimCheck analyzes your RC and insurance policy to detect claim
        rejection risks.
      </p>

      <button
        onClick={() => navigate("/check")}
        className="mt-8 bg-slate-900 text-white px-6 py-3 rounded-lg text-lg"
      >
        Check My Insurance
      </button>
    </div>
  );
}
