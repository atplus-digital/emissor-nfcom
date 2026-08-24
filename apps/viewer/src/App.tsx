import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { getSession } from "./api";
import { AuthContext, Layout } from "./components/Layout";
import { ThemeProvider } from "./components/theme-provider";
import { EmitirFatura } from "./pages/EmitirFatura";
import { FaturaDetalhe } from "./pages/FaturaDetalhe";
import { Faturas } from "./pages/Faturas";
import { Filas } from "./pages/Filas";
import { Login } from "./pages/Login";
import { ParceiroDetalhe } from "./pages/ParceiroDetalhe";
import { Parceiros } from "./pages/Parceiros";
import type { User } from "./types";

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
		<ThemeProvider>
			<AuthContext.Provider value={{ user, setUser: setUserCb }}>
				<Toaster />
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
					<Route
						path="/parceiros"
						element={
							user ? (
								<Layout>
									<Parceiros />
								</Layout>
							) : (
								<Navigate to="/login" replace />
							)
						}
					/>
					<Route
						path="/parceiros/:id"
						element={
							user ? (
								<Layout>
									<ParceiroDetalhe />
								</Layout>
							) : (
								<Navigate to="/login" replace />
							)
						}
					/>
					<Route
						path="/emitir"
						element={
							user ? (
								<Layout>
									<EmitirFatura />
								</Layout>
							) : (
								<Navigate to="/login" replace />
							)
						}
					/>
					<Route
						path="/filas"
						element={
							user ? (
								<Layout>
									<Filas />
								</Layout>
							) : (
								<Navigate to="/login" replace />
							)
						}
					/>
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</AuthContext.Provider>
		</ThemeProvider>
	);
}
