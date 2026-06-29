import { Link } from "react-router-dom";
import { ArrowLeft, FileQuestion } from "lucide-react";
import StatePanel from "../components/common/StatePanel.jsx";
import { ROUTES } from "../constants/routes.js";

const NotFoundPage = () => {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 text-body">
      <StatePanel
        actions={(
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-accent bg-accent px-4 text-sm font-medium text-white transition hover:bg-[#79b8ff]"
            to={ROUTES.HOME}
          >
            <ArrowLeft size={15} />
            Back to Syncode
          </Link>
        )}
        description="The route you opened does not map to an active Syncode screen."
        eyebrow="404"
        icon={<FileQuestion size={22} />}
        title="Page not found"
      />
    </main>
  );
};

export default NotFoundPage;
