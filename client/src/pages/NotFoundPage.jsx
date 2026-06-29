import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";

const NotFoundPage = () => {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070b12] px-6 text-slate-100">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-cyan-200">404</p>
        <h1 className="mt-3 text-4xl font-semibold">Page not found</h1>
        <Link className="mt-6 inline-block text-cyan-200 hover:text-cyan-100" to={ROUTES.HOME}>
          Back to Syncode
        </Link>
      </div>
    </main>
  );
};

export default NotFoundPage;
