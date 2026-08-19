import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, login } from "../api";
import { useAuth } from "../components/Layout";

export function Login() {
	const [account, setAccount] = useState("");
	const [password, setPassword] = useState("");
	const [erro, setErro] = useState<string | null>(null);
	const [carregando, setCarregando] = useState(false);
	const { setUser } = useAuth();
	const navigate = useNavigate();

	const onSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setErro(null);
		setCarregando(true);
		try {
			const user = await login(account, password);
			setUser(user);
			navigate("/", { replace: true });
		} catch (err) {
			setErro(
				err instanceof ApiError
					? err.mensagem
					: "Erro inesperado. Tente novamente.",
			);
		} finally {
			setCarregando(false);
		}
	};

	return (
		<div className="login-wrap">
			<form className="login-card" onSubmit={(e) => void onSubmit(e)}>
				<h1>Emissor NFCom</h1>
				<p className="muted">Acesse o painel de faturas e notas</p>
				{erro && (
					<div className="alert alert-error" role="alert">
						{erro}
					</div>
				)}
				<label>
					<span>Conta</span>
					<input
						type="text"
						value={account}
						onChange={(e) => setAccount(e.target.value)}
						autoComplete="username"
						required
						autoFocus
					/>
				</label>
				<label>
					<span>Senha</span>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
						required
					/>
				</label>
				<button className="btn btn-primary" disabled={carregando}>
					{carregando ? "Entrando…" : "Entrar"}
				</button>
			</form>
		</div>
	);
}
