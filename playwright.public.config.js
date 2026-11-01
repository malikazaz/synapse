import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.cache/browsers');
export default defineConfig({testDir:'./tests/public',timeout:30000,outputDir:'test-results/public',use:{baseURL:'http://127.0.0.1:8788/synapse/',headless:true},webServer:{command:'node scripts/test-server.mjs --public',url:'http://127.0.0.1:8788/synapse/',reuseExistingServer:false},projects:[{name:'desktop',use:{browserName:'chromium'}},{name:'phone',use:{browserName:'chromium',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]});
