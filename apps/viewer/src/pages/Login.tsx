import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, login } from "../api";
import { useAuth } from "../components/Layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-[380px]">
				<CardHeader>
					<CardTitle className="text-xl">Emissor NFCom</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						className="flex flex-col gap-4"
						onSubmit={(e) => void onSubmit(e)}
					>
						<p className="text-sm text-muted-foreground">
							Acesse o painel de faturas e notas
						</p>
						{erro && (
							<Alert variant="destructive">
								<AlertDescription>{erro}</AlertDescription>
							</Alert>
						)}
						<div className="flex flex-col gap-2">
							<Label htmlFor="account">Conta</Label>
							<Input
								id="account"
								type="text"
								value={account}
								onChange={(e) => setAccount(e.target.value)}
								autoComplete="username"
								required
								autoFocus
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Senha</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								autoComplete="current-password"
								required
							/>
						</div>
						<Button className="w-full" disabled={carregando}>
							{carregando ? "Entrando…" : "Entrar"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
