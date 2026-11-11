import { NavLink, Outlet } from "react-router";
import { Shield, Swords } from "lucide-react";
import { Toaster } from "sonner";
import { Tooltip, TooltipProvider } from "../components/ui/tooltip.js";
import { cn } from "../lib/cn.js";

const navItems = [
  { to: "/heroes", label: "Heróis", icon: Shield },
  { to: "/missions", label: "Missões", icon: Swords },
];

export function RootLayout() {
  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-background">
        <nav
          aria-label="Navegação principal"
          className="flex items-center justify-center gap-2 border-b border-border bg-white py-3"
        >
          {navItems.map(({ to, label, icon: Icon }) => (
            <Tooltip key={to} content={label}>
              <NavLink
                to={to}
                aria-label={label}
                className={({ isActive }) =>
                  cn(
                    "rounded-full p-2.5 text-gray-500 hover:bg-primary-soft hover:text-primary",
                    isActive && "bg-primary-soft text-primary",
                  )
                }
              >
                <Icon className="size-5" aria-hidden="true" />
              </NavLink>
            </Tooltip>
          ))}
        </nav>
        <main className="mx-auto max-w-[1920px] px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="bottom-center" closeButton />
    </TooltipProvider>
  );
}
