import { LogOut, ReceiptText } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { logout } from "../api";
import type { User } from "../types";
import { ThemeToggle } from "./theme-toggle";

interface AuthCtx {
	user: User | null;
	setUser: (u: User | null) => void;
}

export const AuthContext = createContext<AuthCtx>({
	user: null,
	setUser: () => {},
});

export function useAuth(): AuthCtx {
	return useContext(AuthContext);
}

const NAV_ITEMS = [
	{ to: "/", label: "Faturas" },
	{ to: "/parceiros", label: "Parceiros" },
	{ to: "/emitir", label: "Nova fatura" },
	{ to: "/filas", label: "Filas" },
] as const;

/** Header global: marca + navegação + usuário logado + logout. */
export function Layout({ children }: { children: ReactNode }) {
	const { user, setUser } = useAuth();
	const navigate = useNavigate();

	const onLogout = useCallback(async () => {
		try {
			await logout();
		} catch {
			// sessão pode já ter expirado — seguimos p/ login
		}
		setUser(null);
		navigate("/login", { replace: true });
	}, [navigate, setUser]);

	const initials =
		user?.nickname
			?.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase())
			.join("") ?? "";

	return (
		<div className="min-h-screen flex flex-col">
			<header className="sticky top-0 z-10 border-b bg-card/95 shadow-xs backdrop-blur">
				<div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-5 px-5">
					<Link
						to="/"
						className="flex shrink-0 items-center gap-2.5"
						aria-label="Emissor NFCom — início"
					>
						<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
							<ReceiptText className="size-4" />
						</span>
						<span className="flex items-center gap-2">
							<span className="font-semibold tracking-tight">
								Emissor NFCom
							</span>
							<Badge variant="secondary" className="hidden sm:inline-flex">
								Painel
							</Badge>
						</span>
					</Link>

					<nav aria-label="Navegação" className="flex items-center gap-1">
						{NAV_ITEMS.map((item) => (
							<NavLink
								key={item.to}
								to={item.to}
								end={item.to === "/"}
								className={({ isActive }) =>
									cn(
										"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
										isActive
											? "bg-accent text-foreground"
											: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
									)
								}
							>
								{item.label}
							</NavLink>
						))}
					</nav>

					{user && (
						<div className="ml-auto flex shrink-0 items-center gap-1.5">
							<span className="hidden items-center gap-2 lg:flex">
								<span
									aria-hidden
									className="grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-foreground"
								>
									{initials || user.nickname?.charAt(0)?.toUpperCase()}
								</span>
								<span className="max-w-36 truncate text-sm text-muted-foreground">
									{user.nickname}
								</span>
							</span>
							<ThemeToggle />
							<Separator orientation="vertical" className="mx-1 h-5" />
							<Button variant="ghost" size="sm" onClick={() => void onLogout()}>
								<LogOut className="size-4" />
								Sair
							</Button>
						</div>
					)}
				</div>
			</header>
			<main className="w-full max-w-[1100px] mx-auto p-5 flex-1">
				{children}
			</main>
		</div>
	);
}
