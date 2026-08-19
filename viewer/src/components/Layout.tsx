import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api";
import type { User } from "../types";

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

/** Header global: título + usuário logado + logout. */
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

	return (
		<div className="layout">
			<header className="topbar">
				<span className="topbar-title">Emissor NFCom — Painel</span>
				{user && (
					<span className="topbar-right">
						<span className="topbar-user">{user.nickname}</span>
						<button className="btn btn-ghost" onClick={() => void onLogout()}>
							Sair
						</button>
					</span>
				)}
			</header>
			<main className="content">{children}</main>
		</div>
	);
}
