import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getSession } from "./api";
import { AuthContext, Layout } from "./components/Layout";
import type { User } from "./types";
import { FaturaDetalhe } from "./pages/FaturaDetalhe";
import { Faturas } from "./pages/Faturas";
import { Login } from "./pages/Login";

export default function App() {
	const [user, setUser] = useState<User | null>(null);
	const [checando, setChecando] = useState(true);

	useEffect(() => {
		getSession()
			.then((u) => setUser(u))
			.catch(() => setUser(null))
			.finally(() => setChecando(false));
	}, []);

	const setUserCb = useCallback((u: User | null) => setUser(u), []);

	if (checando) {
		return <p className="muted">Verificando sessão…</p>;
	}

	return (
		<AuthContext.Provider value={{ user, setUser: setUserCb }}>
			<Routes>
				<Route path="/login" element={<Login />} />
				<Route
					path="/"
					element={
						user ? (
							<Layout>
								<Faturas />
							</Layout>
						) : (
							<Navigate to="/login" replace />
						)
					}
				/>
				<Route
					path="/faturas/:id"
					element={
						user ? (
							<Layout>
								<FaturaDetalhe />
							</Layout>
						) : (
							<Navigate to="/login" replace />
						)
					}
				/>
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</AuthContext.Provider>
	);
}
