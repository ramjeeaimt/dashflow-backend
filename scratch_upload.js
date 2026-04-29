const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dxju8ikk4',
  api_key: '987552422788319',
  api_secret: 'uLMBt_AGwb3S-aR5vbR-kM25xXM'
});

const imagePath = '/Users/rajesh/.gemini/antigravity/brain/8ed260cf-e65d-4f77-888c-c921768ddce7/media__1777463514817.png';

cloudinary.uploader.upload(imagePath, { public_id: 'difmo_banner_v2' }, function(error, result) {
  if (error) {
    console.error('Upload Error:', error);
  } else {
    console.log('UPLOAD_SUCCESS');
    console.log('URL:' + result.secure_url);
  }
});
