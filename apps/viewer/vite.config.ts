import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: proxia /painel para o emissor Hono — o cookie HttpOnly SameSite
// funciona no mesmo origin via proxy. No compose o alvo é o serviço `app`
// (VITE_PROXY_TARGET=http://app:3000); no host (dev sem compose) cai no default
// http://localhost:3000.
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		proxy: {
			"/painel": {
				target: process.env.VITE_PROXY_TARGET ?? "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
});
