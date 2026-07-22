const { Jimp } = require('jimp');
const path = require('path');

const inputImagePath = path.join(__dirname, 'public', 'Palmtree-BrandingKIt.png');
const outputLogo = path.join(__dirname, 'public', 'logo.png');
const outputFavicon = path.join(__dirname, 'public', 'favicon.png');

async function cropImages() {
  try {
    const image = await Jimp.read(inputImagePath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    console.log(`Original image size: ${width}x${height}`);

    const logoCropLeft = Math.floor(width * 0.1);
    const logoCropTop = Math.floor(height * 0.05);
    const logoCropWidth = Math.floor(width * 0.35);
    const logoCropHeight = Math.floor(height * 0.35);

    const logoImg = image.clone().crop({ x: logoCropLeft, y: logoCropTop, w: logoCropWidth, h: logoCropHeight });
    await logoImg.write(outputLogo);
    console.log(`Created ${outputLogo}`);

    const faviconLeft = Math.floor(width * 0.12);
    const faviconTop = Math.floor(height * 0.05);
    const faviconWidth = Math.floor(width * 0.15);
    const faviconHeight = Math.floor(height * 0.15);
    
    const favImg = image.clone().crop({ x: faviconLeft, y: faviconTop, w: faviconWidth, h: faviconHeight }).resize({ w: 64, h: 64 });
    await favImg.write(outputFavicon);
    console.log(`Created ${outputFavicon}`);

  } catch (error) {
    console.error('Error cropping images:', error);
  }
}

cropImages();
