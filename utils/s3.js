// imports the AWS SDK library
import AWS from 'aws-sdk';

// creates a new S3 client instance
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION
});

export default s3;
