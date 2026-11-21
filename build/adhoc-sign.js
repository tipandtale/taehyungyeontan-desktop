// Ad-hoc sign the macOS app so Apple Silicon Macs show the normal
// "unidentified developer" prompt instead of "app is damaged".
const { execSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log('ad-hoc signing', app);
  execSync(`codesign --force --deep --sign - "${app}"`, { stdio: 'inherit' });
};
