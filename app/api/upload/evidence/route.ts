import { NextResponse } from 'next/server';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { fileData, fileName, mimeType } = body;

    if (!fileData || !mimeType) {
      return NextResponse.json(
        { success: false, error: 'File data and MIME type are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'Invalid file format. Supported: JPG, PNG, WEBP' },
        { status: 400 }
      );
    }

    // Check size roughly from base64 string
    const approxSizeBytes = (fileData.length * 3) / 4;
    if (approxSizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image size exceeds maximum limit of 5 MB' },
        { status: 400 }
      );
    }

    // In a production server with S3 / GCS / Cloud Storage, upload to bucket.
    // For local / Firestore data uri storage, normalize and return the data URI or signed URL
    const normalizedDataUrl = fileData.startsWith('data:')
      ? fileData
      : `data:${mimeType};base64,${fileData}`;

    return NextResponse.json({
      success: true,
      url: normalizedDataUrl,
      fileName: fileName || `evidence_${Date.now()}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Server error uploading evidence' },
      { status: 500 }
    );
  }
}
