import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { app, isFirebaseConfigured } from './firebase';

let storageInstance: FirebaseStorage | null = null;

if (typeof window !== 'undefined' || process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  try {
    if (isFirebaseConfigured() && app) {
      storageInstance = getStorage(app);
    }
  } catch (error) {
    console.warn('Firebase Storage initialization skipped or failed:', error);
  }
}

export const storage = storageInstance;

/**
 * Uploads a local file to Firebase Storage and returns the public HTTPS download URL.
 * @param file File object from file input
 * @param folder Subfolder in storage bucket (default: 'products')
 */
export async function uploadProductImageFS(file: File, folder = 'products'): Promise<string | null> {
  if (!isFirebaseConfigured() || !storageInstance) {
    console.warn('Firebase Storage is not configured. Falling back to object URL.');
    return URL.createObjectURL(file);
  }

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${folder}/${Date.now()}_${cleanFileName}`;
    const fileRef = ref(storageInstance, storagePath);

    // Upload file bytes
    await uploadBytes(fileRef, file);

    // Get public download URL
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file to Firebase Storage:', error);
    // Fallback to local Blob URL so UI never crashes
    return URL.createObjectURL(file);
  }
}
