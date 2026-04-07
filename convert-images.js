const sharp = require('sharp');
const glob = require('glob');
const fs = require('fs');
const path = require('path');

const MAX_WIDTH = 1200;
const QUALITY = 80;

async function convertImages() {
  const files = glob.sync('assets/images/**/*.{png,jpg,jpeg,webp}');
  
  for (const file of files) {
    const ext = path.extname(file);
    const outFile = file.replace(ext, '.avif');
    
    console.log(`Processing ${file}...`);
    
    try {
      let pipeline = sharp(file);
      const metadata = await pipeline.metadata();
      
      if (metadata.width > MAX_WIDTH) {
        pipeline = pipeline.resize(MAX_WIDTH);
      }
      
      await pipeline
        .avif({ quality: QUALITY })
        .toFile(outFile);
      
      console.log(`Saved to ${outFile}`);
      
      // Delete original file after conversion
      fs.unlinkSync(file);
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
}

convertImages();
