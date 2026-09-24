const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  const styles = await page.evaluate(() => {
    const getZ = (el) => window.getComputedStyle(el).zIndex;
    const getBg = (el) => window.getComputedStyle(el).backgroundColor;
    return {
      bodyBg: getBg(document.body),
      bodyZ: getZ(document.body),
      platformBgZ: getZ(document.querySelector('.platform-bg-effects')),
      mainBg: getBg(document.querySelector('main')),
      mainZ: getZ(document.querySelector('main')),
      heroBg: getBg(document.querySelector('.hero')),
      blobOpacity: window.getComputedStyle(document.querySelector('.platform-blob-1')).opacity
    };
  });
  console.log(styles);
  await browser.close();
})();
