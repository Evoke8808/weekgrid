import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { boot, ui } from './lib/store.svelte.js';
import { motion } from './lib/motion.js';
import { startPwa, setSafeCheck } from './lib/pwa.svelte.js';
import { restRunning, cardio } from './lib/gymui.svelte.js';

document.documentElement.classList.add(`motion-${motion}`);
boot();
mount(App, { target: document.getElementById('app') });

// Never swap versions under a running rest timer, cardio timer or open workout.
setSafeCheck(() => !ui.gym && !restRunning() && !cardio.s);
startPwa();
