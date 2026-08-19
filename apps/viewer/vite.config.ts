import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: proxia /painel para o emissor local (:3000) — o cookie HttpOnly
// SameSite funciona no mesmo origin via proxy.
export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			"/painel": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
});
