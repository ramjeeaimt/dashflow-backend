const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dxju8ikk4',
  api_key: '987552422788319',
  api_secret: 'uLMBt_AGwb3S-aR5vbR-kM25xXM'
});

const imagePath = '/Users/rajesh/Desktop/Screenshot 2026-04-29 at 5.10.49\u202fPM.png';

cloudinary.uploader.upload(imagePath, { public_id: 'difmo_banner_final' }, function(error, result) {
  if (error) {
    console.error('Upload Error:', error);
  } else {
    console.log('UPLOAD_SUCCESS');
    console.log('URL:' + result.secure_url);
  }
});
