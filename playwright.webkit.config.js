import config from './playwright.config.js';

// Optional Safari-engine checks; install with: npx playwright install webkit
export default {...config,testMatch:'mobile.spec.js',outputDir:'test-results/webkit',projects:[{name:'webkit-phone',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]};
