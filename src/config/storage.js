// Storage configuration (MinIO/S3)
const Minio = require('minio');

const minioClient = new Minio.Client({
  endPoint: process.env.STORAGE_ENDPOINT,
  port: parseInt(process.env.STORAGE_PORT, 10),
  useSSL: false,
  accessKey: process.env.STORAGE_ACCESS_KEY,
  secretKey: process.env.STORAGE_SECRET_KEY
});

module.exports = { minioClient };
