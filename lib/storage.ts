import "server-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const bucket = process.env.S3_BUCKET;
const region = process.env.S3_REGION;

function getS3() {
  if (!bucket || !region) throw new Error("S3_BUCKET and S3_REGION must be set before uploading images.");

  return new S3Client({
    region,
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
}

export async function createUploadUrl(userId: string, projectId: string, fileName: string, contentType: string) {
  const extension = fileName.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/)?.[1] ?? "png";
  const key = `projects/${userId}/${projectId}/${randomUUID()}.${extension}`;
  const uploadUrl = await getSignedUrl(getS3(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
  return { key, uploadUrl };
}

export async function createDownloadUrl(key: string) {
  return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}
