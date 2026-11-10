import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./RootLayout.js";
import { HeroesPage } from "../features/heroes/pages/HeroesPage.js";
import { MissionsPage } from "../features/missions/pages/MissionsPage.js";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/heroes" replace /> },
      { path: "/heroes", element: <HeroesPage /> },
      { path: "/missions", element: <MissionsPage /> },
    ],
  },
]);
