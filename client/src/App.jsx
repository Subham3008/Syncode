import { Route, Routes } from "react-router-dom";
import { ROUTES } from "./constants/routes.js";
import HomePage from "./pages/HomePage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RoomPage from "./pages/RoomPage.jsx";

const App = () => {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<HomePage />} />
      <Route path={ROUTES.ROOM} element={<RoomPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;