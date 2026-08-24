import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/** Alterna entre tema claro e escuro. */
export function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			aria-label="Alternar tema"
		>
			<Sun className="hidden dark:block size-4" />
			<Moon className="block dark:hidden size-4" />
		</Button>
	);
}
