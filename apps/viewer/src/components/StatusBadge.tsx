import type { VariantProps } from "class-variance-authority";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Badge colorido por status de fatura/cobrança/nota e situação SEFAZ. */

const CORES: Record<string, { variant: Variant; className?: string }> = {
	"fatura|a-emitir": { variant: "secondary" },
	"fatura|emitindo": {
		variant: "outline",
		className: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400",
	},
	"fatura|emitida": {
		variant: "outline",
		className: "border-green-500/50 text-green-700 dark:text-green-400",
	},
	"fatura|parcial": {
		variant: "outline",
		className: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400",
	},
	"fatura|erro": { variant: "destructive" },
	"fatura|pago": {
		variant: "outline",
		className: "border-blue-500/50 text-blue-700 dark:text-blue-400",
	},
	"fatura|cancelada": { variant: "secondary", className: "bg-muted-foreground/20" },
	"cobranca|a-emitir": { variant: "secondary" },
	"cobranca|emitida": {
		variant: "outline",
		className: "border-green-500/50 text-green-700 dark:text-green-400",
	},
	"cobranca|erro": { variant: "destructive" },
	"nota|a-emitir": { variant: "secondary" },
	"nota|emitida": {
		variant: "outline",
		className: "border-green-500/50 text-green-700 dark:text-green-400",
	},
	"nota|erro": { variant: "destructive" },
	"nota|cancelada": { variant: "secondary", className: "bg-muted-foreground/20" },
	"situacao|autorizada": {
		variant: "outline",
		className: "border-green-500/50 text-green-700 dark:text-green-400",
	},
	"situacao|rejeitada": { variant: "destructive" },
	"situacao|cancelada": { variant: "secondary" },
	"situacao|processando": {
		variant: "outline",
		className: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400",
	},
};

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

type Escopo = "fatura" | "cobranca" | "nota" | "situacao";

export function StatusBadge({
	escopo,
	value,
}: {
	escopo: Escopo;
	value: string | null | undefined;
}) {
	if (!value) return <Badge variant="secondary">—</Badge>;
	const css = CORES[`${escopo}|${value}`] ?? { variant: "secondary" as const };
	return (
		<Badge variant={css.variant} className={cn("capitalize", css.className)}>
			{value}
		</Badge>
	);
}
