import { v2 as cloudinary } from "cloudinary";
import { loadEnv } from "../config/env";

function ensureConfigured(): void {
  const env = loadEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured");
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export async function uploadLeaseDocument(
  buffer: Buffer,
  originalName: string
): Promise<{ url: string; publicId: string }> {
  ensureConfigured();
  const safeName = originalName.replace(/[^\w.\-]+/g, "_").slice(0, 120);

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "tenantos/lease-documents",
        resource_type: "auto",
        use_filename: true,
        filename_override: safeName || "document",
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error("Upload failed"));
        else resolve(res);
      }
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

const MAX_PROPERTY_IMAGE_BYTES = 8 * 1024 * 1024;

/** Landlord marketing photos for a property (images only). */
export async function uploadPropertyPhoto(
  buffer: Buffer,
  originalName: string
): Promise<{ url: string; publicId: string }> {
  ensureConfigured();
  const safeName = originalName.replace(/[^\w.\-]+/g, "_").slice(0, 120);

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "tenantos/property-photos",
        resource_type: "image",
        use_filename: true,
        filename_override: safeName || "photo",
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error("Upload failed"));
        else resolve(res);
      }
    );
    stream.end(buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

export { MAX_PROPERTY_IMAGE_BYTES };

export async function destroyCloudinaryAsset(publicId: string): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId);
}
