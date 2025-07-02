import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { redwood } from "rwsdk/vite";
export default defineConfig({
	plugins: [
		redwood(),
		tailwindcss()
	],
	server: {
		port: 6123
	}
});
